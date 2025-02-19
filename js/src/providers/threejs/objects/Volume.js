//jshint maxstatements:false

'use strict';

var THREE = require('three'),
    lut = require('./../../../core/lib/helpers/lut'),
    closestPowOfTwo = require('./../helpers/Fn').closestPowOfTwo,
    typedArrayToThree = require('./../helpers/Fn').typedArrayToThree;

/**
 * Loader strategy to handle Volume object
 * @method Volume
 * @memberof K3D.Providers.ThreeJS.Objects
 * @param {Object} config all configurations params from JSON
 * @param {K3D}
 * @return {Object} 3D object ready to render
 */
module.exports = {
    create: function (config, K3D) {
        config.samples = config.samples || 512.0;
        config.alpha_coef = config.alpha_coef || 50.0;
        config.gradient_step = config.gradient_step || 0.005;
        config.shadow = config.shadow || 'off';
        config.shadow_delay = config.shadow_delay || 500;
        config.shadow_res = closestPowOfTwo(config.shadow_res || 128);

        config.ray_samples_count = config.ray_samples_count || 16;
        config.focal_plane = config.focal_plane || 512.0;
        config.focal_length = typeof (config.focal_length) !== 'undefined' ? config.focal_length : 0.0;

        var gl = K3D.getWorld().renderer.context,
            geometry = new THREE.BoxBufferGeometry(1, 1, 1),
            modelMatrix = new THREE.Matrix4(),
            translation = new THREE.Vector3(),
            rotation = new THREE.Quaternion(),
            scale = new THREE.Vector3(),
            maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE),
            lightMapSize = config.shadow_res,
            lightMapRenderTargetSize,
            colorMap = (config.color_map && config.color_map.data) || null,
            colorRange = config.color_range,
            samples = config.samples,
            sceneRTT,
            cameraRTT,
            quadRTT,
            textureRTT,
            object,
            texture,
            jitterTexture,
            listenersId,
            timeoutId,
            lastShadowMapUpdated = 0;

        lightMapSize = (lightMapSize > 512 ? 512 : lightMapSize);
        lightMapRenderTargetSize = closestPowOfTwo(Math.sqrt(lightMapSize * lightMapSize * lightMapSize));

        if (lightMapRenderTargetSize > maxTextureSize) {
            throw new Error('To big light map size. gl.MAX_TEXTURE_SIZE=' + maxTextureSize);
        }

        modelMatrix.set.apply(modelMatrix, config.model_matrix.data);
        modelMatrix.decompose(translation, rotation, scale);

        texture = new THREE.DataTexture3D(
            config.volume.data,
            config.volume.shape[2],
            config.volume.shape[1],
            config.volume.shape[0]);

        texture.format = THREE.RedFormat;
        texture.type = typedArrayToThree(config.volume.data.constructor);

        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
        texture.needsUpdate = true;

        jitterTexture = new THREE.DataTexture(
            new Uint8Array(_.range(64 * 64).map(function () {
                return 255.0 * Math.random();
            })),
            64, 64, THREE.RedFormat, THREE.UnsignedByteType);
        jitterTexture.minFilter = THREE.LinearFilter;
        jitterTexture.magFilter = THREE.LinearFilter;
        jitterTexture.wrapS = jitterTexture.wrapT = THREE.RepeatWrapping;
        jitterTexture.generateMipmaps = false;
        jitterTexture.needsUpdate = true;

        var canvas = lut(colorMap, 1024);
        var colormap = new THREE.CanvasTexture(canvas, THREE.UVMapping, THREE.ClampToEdgeWrapping,
            THREE.ClampToEdgeWrapping, THREE.NearestFilter, THREE.NearestFilter);
        colormap.needsUpdate = true;

        if (config.shadow !== 'off') {
            textureRTT = new THREE.WebGLRenderTarget(lightMapRenderTargetSize, lightMapRenderTargetSize, {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RedFormat,
                type: THREE.UnsignedByteType,
                generateMipmaps: false,
                stencilBuffer: false,
                depthBuffer: false
            });
        }

        var uniforms = {
            lightMapSize: {value: new THREE.Vector3(lightMapSize, lightMapSize, lightMapSize)},
            volumeMapSize: {value: new THREE.Vector3(config.volume.shape[2], config.volume.shape[1], config.volume.shape[0])},
            lightMapRenderTargetSize: {value: new THREE.Vector2(lightMapRenderTargetSize, lightMapRenderTargetSize)},
            low: {value: colorRange[0]},
            high: {value: colorRange[1]},
            samples: {value: samples},
            alpha_coef: {value: config.alpha_coef},
            gradient_step: {value: config.gradient_step},
            translation: {value: translation},
            rotation: {value: rotation},
            shadowTexture: {type: 't', value: (textureRTT ? textureRTT.texture : null)},
            focal_length: {value: config.focal_length},
            focal_plane: {value: config.focal_plane},
            scale: {value: scale},
            volumeTexture: {type: 't', value: texture},
            colormap: {type: 't', value: colormap},
            jitterTexture: {type: 't', value: jitterTexture}
        };

        var material = new THREE.ShaderMaterial({
            uniforms: _.merge(
                uniforms,
                THREE.UniformsLib.lights
            ),
            defines: {
                USE_SPECULAR: 1,
                USE_SHADOW: (config.shadow !== 'off' ? 1 : 0),
                RAY_SAMPLES_COUNT: config.focal_length !== 0.0 ? config.ray_samples_count : 0
            },
            vertexShader: require('./shaders/Volume.vertex.glsl'),
            fragmentShader: require('./shaders/Volume.fragment.glsl'),
            side: THREE.BackSide,
            depthTest: false,
            depthWrite: false,
            lights: true,
            clipping: true,
            transparent: true
        });

        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();

        object = new THREE.Mesh(geometry, material);
        object.applyMatrix(modelMatrix);
        object.updateMatrixWorld();

        /*
            Light Map support
         */
        if (config.shadow !== 'off') {
            sceneRTT = new THREE.Scene();
            quadRTT = new THREE.Mesh(
                new THREE.PlaneBufferGeometry(lightMapRenderTargetSize, lightMapRenderTargetSize),
                new THREE.ShaderMaterial({
                    uniforms: _.merge(
                        uniforms,
                        THREE.UniformsLib.lights,
                        {
                            lightDirection: {type: 'v3', value: new THREE.Vector3()}
                        }
                    ),
                    defines: {
                        USE_MAP: 1
                    },
                    vertexShader: require('./shaders/Volume.lightmap.vertex.glsl'),
                    fragmentShader: require('./shaders/Volume.lightmap.fragment.glsl'),
                    clipping: true,
                    depthWrite: false,
                    depthTest: false
                }));

            // for clipping planes
            quadRTT.applyMatrix(modelMatrix);
            quadRTT.updateMatrixWorld();

            cameraRTT = new THREE.OrthographicCamera(
                lightMapRenderTargetSize / -2, lightMapRenderTargetSize / 2,
                lightMapRenderTargetSize / 2, lightMapRenderTargetSize / -2,
                -10000, 10000);

            cameraRTT.position.z = 100;
            sceneRTT.add(quadRTT);

            object.refreshLightMap = function (direction) {
                if (textureRTT) {
                    var renderer = K3D.getWorld().renderer;
                    var cameraPosition = new THREE.Vector3();

                    if (direction) {
                        quadRTT.material.uniforms.lightDirection.value.fromArray(direction).normalize();
                    } else {
                        K3D.getWorld().camera.getWorldPosition(cameraPosition);
                        quadRTT.material.uniforms.lightDirection.value.copy(
                            translation.clone().sub(cameraPosition).normalize()
                        );
                    }

                    K3D.getWorld().camera.updateMatrixWorld();

                    quadRTT.material.uniformsNeedUpdate = true;

                    renderer.clippingPlanes = [];
                    K3D.parameters.clippingPlanes.forEach(function (plane) {
                        renderer.clippingPlanes.push(new THREE.Plane(new THREE.Vector3().fromArray(plane), plane[3]));
                    });

                    renderer.setRenderTarget(textureRTT);
                    renderer.clear(true, true, true);
                    renderer.render(sceneRTT, cameraRTT);
                    renderer.setRenderTarget(null);
                }
            };

            if (config.shadow === 'dynamic') {
                listenersId = K3D.on(K3D.events.BEFORE_RENDER, function () {
                    var now = new Date().getTime();

                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }

                    // check if we should updated shadow map because user interaction
                    if (now - lastShadowMapUpdated >= config.shadow_delay) {
                        object.refreshLightMap();
                        lastShadowMapUpdated = now;
                    } else {
                        // handle last update on end of user interaction
                        timeoutId = setTimeout(function () {
                            object.refreshLightMap();
                            lastShadowMapUpdated = now;
                            K3D.render();
                        }, Math.max(config.shadow_delay, 500));
                    }
                });
            }

            object.refreshLightMap();
        }

        object.onRemove = function () {
            quadRTT.material.uniforms.volumeTexture.value.dispose();
            quadRTT.material.uniforms.volumeTexture.value = undefined;
            object.material.uniforms.volumeTexture.value = undefined;
            object.material.uniforms.colormap.value.dispose();
            object.material.uniforms.colormap.value = undefined;
            jitterTexture.dispose();
            jitterTexture = undefined;

            if (sceneRTT) {
                sceneRTT = undefined;
            }

            if (cameraRTT) {
                cameraRTT = undefined;
            }

            if (textureRTT) {
                textureRTT.dispose();
                textureRTT = undefined;
            }

            if (listenersId) {
                K3D.off(K3D.events.BEFORE_RENDER, listenersId);
            }
        };

        return Promise.resolve(object);
    }
};
