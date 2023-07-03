// uno.config.ts
import {
  defineConfig, presetAttributify, presetIcons,
  presetTypography, presetUno,
  transformerDirectives, transformerVariantGroup,
} from 'unocss'
import { presetForms } from '@julr/unocss-preset-forms'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons(),
    presetTypography(),
    presetForms()
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
})