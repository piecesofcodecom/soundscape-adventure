import { terser } from 'rollup-plugin-terser'
import multi from '@rollup/plugin-multi-entry'

export default [
    {
        input: {
            include: [
                'scripts/*.js',
                'scripts/*.mjs'
            ]
        },
        output: {
            format: 'esm',
            file: 'dist/soundscape-adventure.min.js'
        },
        plugins: [
            terser({ keep_classnames: true, keep_fnames: true }),
            multi()
        ]
    }
]