'use strict';
//jshint ignore: start
//jscs:disable

module.exports = function (THREE) {
    function MeshLine() {
        this.positions = [];
        this.previous = [];
        this.next = [];
        this.side = [];
        this.width = [];
        this.indices_array = [];
        this.uvs = [];
        this.counters = [];
        this.geometry = new THREE.BufferGeometry();
    }

    MeshLine.prototype.setGeometry = function (g, segments, widths, colors, uvs) {
        var j, c, l;

        this.positions = [];
        this.counters = [];
        this.width = [];
        this.colors = [];
        this.uvs = [];

        if (g instanceof Float32Array || g instanceof Array) {
            for (j = 0; j < g.length; j += 3) {
                c = j / g.length;
                this.positions.push(g[j], g[j + 1], g[j + 2]);
                this.positions.push(g[j], g[j + 1], g[j + 2]);
                this.counters.push(c);
                this.counters.push(c);
            }
        }

        l = this.positions.length / 6;

        for (j = 0; j < this.positions.length / 6; j++) {
            if (widths) {
                this.width.push(widths[j], widths[j]);
            } else {
                this.width.push(1.0, 1.0);
            }

            if (colors) {
                this.colors.push(colors[j * 3], colors[j * 3 + 1], colors[j * 3 + 2]);
                this.colors.push(colors[j * 3], colors[j * 3 + 1], colors[j * 3 + 2]);
            } else {
                this.colors.push(1.0, 1.0, 1.0);
                this.colors.push(1.0, 1.0, 1.0);
            }

            if (uvs) {
                this.uvs.push(uvs[j], 0);
                this.uvs.push(uvs[j], 1);
            } else {
                this.uvs.push(j / (l - 1), 0);
                this.uvs.push(j / (l - 1), 1);
            }
        }

        this.process(segments);
    };

    MeshLine.prototype.compareV3 = function (a, b) {
        var aa = a * 6,
            ab = b * 6;

        return (this.positions[aa] === this.positions[ab]) && (this.positions[aa + 1] === this.positions[ab + 1]) && (this.positions[aa + 2] === this.positions[ab + 2]);

    };

    MeshLine.prototype.copyV3 = function (a) {

        var aa = a * 6;
        return [this.positions[aa], this.positions[aa + 1], this.positions[aa + 2]];

    };

    MeshLine.prototype.process = function (segments) {
        var l = this.positions.length / 6, j, n, k, v;

        this.previous = [];
        this.next = [];
        this.side = [];
        this.indices_array = [];

        for (j = 0; j < l; j++) {
            this.side.push(1);
            this.side.push(-1);
        }

        if (segments) {
            for (j = 0; j < l; j += 2) {
                this.previous.push(this.positions[j * 6], this.positions[j * 6 + 1], this.positions[j * 6 + 2]);
                this.previous.push(this.positions[j * 6], this.positions[j * 6 + 1], this.positions[j * 6 + 2]);
                this.previous.push(this.positions[j * 6], this.positions[j * 6 + 1], this.positions[j * 6 + 2]);
                this.previous.push(this.positions[j * 6], this.positions[j * 6 + 1], this.positions[j * 6 + 2]);
            }

            for (j = 0; j < l; j += 2) {
                k = j + 1;

                this.next.push(this.positions[k * 6], this.positions[k * 6 + 1], this.positions[k * 6 + 2]);
                this.next.push(this.positions[k * 6], this.positions[k * 6 + 1], this.positions[k * 6 + 2]);
                this.next.push(this.positions[k * 6], this.positions[k * 6 + 1], this.positions[k * 6 + 2]);
                this.next.push(this.positions[k * 6], this.positions[k * 6 + 1], this.positions[k * 6 + 2]);
            }

            for (j = 0; j < l - 1; j += 2) {
                n = j * 2;
                this.indices_array.push(n, n + 1, n + 2);
                this.indices_array.push(n + 2, n + 1, n + 3);
            }
        } else {
            if (this.compareV3(0, l - 1)) {
                v = this.copyV3(l - 2);
            } else {
                v = this.copyV3(0);
            }
            this.previous.push(v[0], v[1], v[2]);
            this.previous.push(v[0], v[1], v[2]);
            for (j = 0; j < l - 1; j++) {
                v = this.copyV3(j);
                this.previous.push(v[0], v[1], v[2]);
                this.previous.push(v[0], v[1], v[2]);
            }

            for (j = 1; j < l; j++) {
                v = this.copyV3(j);
                this.next.push(v[0], v[1], v[2]);
                this.next.push(v[0], v[1], v[2]);
            }

            if (this.compareV3(l - 1, 0)) {
                v = this.copyV3(1);
            } else {
                v = this.copyV3(l - 1);
            }
            this.next.push(v[0], v[1], v[2]);
            this.next.push(v[0], v[1], v[2]);

            for (j = 0; j < l - 1; j++) {
                n = j * 2;
                this.indices_array.push(n, n + 1, n + 2);
                this.indices_array.push(n + 2, n + 1, n + 3);
            }
        }

        if (!this.attributes) {
            this.attributes = {
                position: new THREE.BufferAttribute(new Float32Array(this.positions), 3),
                previous: new THREE.BufferAttribute(new Float32Array(this.previous), 3),
                next: new THREE.BufferAttribute(new Float32Array(this.next), 3),
                side: new THREE.BufferAttribute(new Float32Array(this.side), 1),
                width: new THREE.BufferAttribute(new Float32Array(this.width), 1),
                uv: new THREE.BufferAttribute(new Float32Array(this.uvs), 2),
                index: new THREE.BufferAttribute(new Uint32Array(this.indices_array), 1),
                counters: new THREE.BufferAttribute(new Float32Array(this.counters), 1),
                colors: new THREE.BufferAttribute(new Float32Array(this.colors), 3)
            };
        } else {
            this.attributes.position.copyArray(new Float32Array(this.positions));
            this.attributes.position.needsUpdate = true;
            this.attributes.previous.copyArray(new Float32Array(this.previous));
            this.attributes.previous.needsUpdate = true;
            this.attributes.next.copyArray(new Float32Array(this.next));
            this.attributes.next.needsUpdate = true;
            this.attributes.side.copyArray(new Float32Array(this.side));
            this.attributes.side.needsUpdate = true;
            this.attributes.width.copyArray(new Float32Array(this.width));
            this.attributes.width.needsUpdate = true;
            this.attributes.uv.copyArray(new Float32Array(this.uvs));
            this.attributes.uv.needsUpdate = true;
            this.attributes.index.copyArray(new Uint32Array(this.indices_array));
            this.attributes.index.needsUpdate = true;
            this.attributes.colors.copyArray(new Float32Array(this.colors));
            this.attributes.colors.needsUpdate = true;
        }

        this.geometry.addAttribute('position', this.attributes.position);
        this.geometry.addAttribute('previous', this.attributes.previous);
        this.geometry.addAttribute('next', this.attributes.next);
        this.geometry.addAttribute('side', this.attributes.side);
        this.geometry.addAttribute('width', this.attributes.width);
        this.geometry.addAttribute('uv', this.attributes.uv);
        this.geometry.addAttribute('counters', this.attributes.counters);
        this.geometry.addAttribute('colors', this.attributes.colors);

        this.geometry.setIndex(this.attributes.index);
    };

    function MeshLineMaterial(parameters) {

        var vertexShaderSource = [
                'precision highp float;',
                '',
                'attribute vec3 position;',
                'attribute vec3 previous;',
                'attribute vec3 next;',
                'attribute vec3 colors;',
                'attribute float side;',
                'attribute float width;',
                'attribute vec2 uv;',
                'attribute float counters;',
                '',
                'uniform mat4 projectionMatrix;',
                'uniform mat4 modelViewMatrix;',
                'uniform vec2 resolution;',
                'uniform float lineWidth;',
                'uniform vec3 color;',
                'uniform float opacity;',
                'uniform float near;',
                'uniform float far;',
                'uniform float sizeAttenuation;',
                '',
                'varying vec2 vUV;',
                'varying vec4 vColor;',
                'varying float vCounters;',
                '',
                '#include <clipping_planes_pars_vertex>',
                '',
                'vec2 fix( vec4 i, float aspect ) {',
                '',
                '    vec2 res = i.xy / i.w;',
                '    res.x *= aspect;',
                '    vCounters = counters;',
                '    return res;',
                '',
                '}',
                '',
                'void main() {',
                '',
                '    float aspect = resolution.x / resolution.y;',
                '    float pixelWidthRatio = 1. / (resolution.x * projectionMatrix[0][0]);',
                '',
                '    vColor = vec4( color * colors, opacity );',
                '    vUV = uv;',
                '',
                '    #if NUM_CLIPPING_PLANES > 0 && ! defined( PHYSICAL ) && ! defined( PHONG )',
                '    vViewPosition = -(modelViewMatrix * vec4(position, 1.0)).xyz;',
                '    #endif',
                '',
                '    mat4 m = projectionMatrix * modelViewMatrix;',
                '    vec4 finalPosition = m * vec4( position, 1.0 );',
                '    vec4 prevPos = m * vec4( previous, 1.0 );',
                '    vec4 nextPos = m * vec4( next, 1.0 );',
                '',
                '    vec2 currentP = fix( finalPosition, aspect );',
                '    vec2 prevP = fix( prevPos, aspect );',
                '    vec2 nextP = fix( nextPos, aspect );',
                '',
                '    float pixelWidth = finalPosition.w * pixelWidthRatio;',
                '    float w = 1.8 * pixelWidth * lineWidth * width;',
                '',
                '    if( sizeAttenuation == 1. ) {',
                '        w = max(1.8 * pixelWidth * 2.0, 1.8 * lineWidth * width);',
                '    }',
                '',
                '    vec2 dir;',
                '    if( nextP == currentP ) dir = normalize( currentP - prevP );',
                '    else if( prevP == currentP ) dir = normalize( nextP - currentP );',
                '    else {',
                '        vec2 dir1 = normalize( currentP - prevP );',
                '        vec2 dir2 = normalize( nextP - currentP );',
                '        dir = normalize( dir1 + dir2 );',
                '',
                '        vec2 perp = vec2( -dir1.y, dir1.x );',
                '        vec2 miter = vec2( -dir.y, dir.x );',
                '        //w = clamp( w / dot( miter, perp ), 0., 4. * lineWidth * width );',
                '',
                '    }',
                '',
                '    //vec2 normal = ( cross( vec3( dir, 0. ), vec3( 0., 0., 1. ) ) ).xy;',
                '    vec2 normal = vec2( -dir.y, dir.x );',
                '    normal.x /= aspect;',
                '    normal *= .5 * w;',
                '',
                '    vec4 offset = vec4( normal * side, 0.0, 1.0 );',
                '    finalPosition.xy += offset.xy;',
                '',
                '    gl_Position = finalPosition;',
                '',
                '}'],
            fragmentShaderSource = [
                'precision mediump float;',
                '',
                'uniform sampler2D map;',
                'uniform float useMap;',
                'uniform float visibility;',
                '',
                'varying vec2 vUV;',
                'varying vec4 vColor;',
                'varying float vCounters;',
                '',
                '#include <clipping_planes_pars_fragment>',
                '',
                'void main() {',
                '',
                ' #include <clipping_planes_fragment>',
                '',
                '    vec4 c = vColor;',
                '    if( useMap == 1. ) c *= texture2D( map, vUV);',
                '    gl_FragColor = c;',
                '    gl_FragColor.a *= step(vCounters, visibility);',
                '}'],
            material;

        function check(v, d) {
            if (v === undefined) {
                return d;
            }

            return v;
        }

        THREE.Material.call(this);

        parameters = parameters || {};

        this.lineWidth = check(parameters.lineWidth, 1);
        this.map = check(parameters.map, null);
        this.useMap = check(parameters.useMap, 0);
        this.color = check(parameters.color, new THREE.Color(0xffffff));
        this.opacity = check(parameters.opacity, 1);
        this.resolution = check(parameters.resolution, new THREE.Vector2(1, 1));
        this.sizeAttenuation = check(parameters.sizeAttenuation, 1);
        this.near = check(parameters.near, 1);
        this.far = check(parameters.far, 1);
        this.visibility = check(parameters.visibility, 1);

        material = new THREE.RawShaderMaterial({
            uniforms: {
                lineWidth: {type: 'f', value: this.lineWidth},
                map: {type: 't', value: this.map},
                useMap: {type: 'f', value: this.useMap},
                color: {type: 'c', value: this.color},
                opacity: {type: 'f', value: this.opacity},
                resolution: {type: 'v2', value: this.resolution},
                sizeAttenuation: {type: 'f', value: this.sizeAttenuation},
                near: {type: 'f', value: this.near},
                far: {type: 'f', value: this.far},
                visibility: {type: 'f', value: this.visibility}
            },
            vertexShader: vertexShaderSource.join('\r\n'),
            fragmentShader: fragmentShaderSource.join('\r\n'),
            clipping: true
        });

        delete parameters.lineWidth;
        delete parameters.map;
        delete parameters.useMap;
        delete parameters.color;
        delete parameters.opacity;
        delete parameters.resolution;
        delete parameters.sizeAttenuation;
        delete parameters.near;
        delete parameters.far;
        delete parameters.visibility;

        material.type = 'MeshLineMaterial';
        material.setValues(parameters);

        return material;
    }

    MeshLineMaterial.prototype = Object.create(THREE.Material.prototype);
    MeshLineMaterial.prototype.constructor = MeshLineMaterial;

    MeshLineMaterial.prototype.copy = function (source) {
        THREE.Material.prototype.copy.call(this, source);

        this.lineWidth = source.lineWidth;
        this.map = source.map;
        this.useMap = source.useMap;
        this.color.copy(source.color);
        this.opacity = source.opacity;
        this.resolution.copy(source.resolution);
        this.sizeAttenuation = source.sizeAttenuation;
        this.near = source.near;
        this.far = source.far;
        this.visibility = source.visibility;

        return this;
    };

    return {
        MeshLine: MeshLine,
        MeshLineMaterial: MeshLineMaterial
    };
};
