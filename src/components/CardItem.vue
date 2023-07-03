<script setup lang="ts">
interface Props {
  title: string
  loading?: boolean
  loadingText?: string
}
const props = withDefaults(defineProps<Props>(), {
  loading: false,
  loadingText: '正在加载'
})
</script>
<template>
  <div
    class="position-relative w-full flex flex-col justify-between rounded bg-white p-4 text-sm text-slate shadow"
  >
    <div
      class="mb-2 border-b border-slate-200 border-solid pb-2 text-base font-semibold text-slate-700"
    >
      {{ props.title }}
    </div>
    <slot></slot>
    <div
      class="position-absolute left-0 top-0 h-full w-full flex items-center justify-center gap-2 bg-white/30 text-slate backdrop-blur-lg"
      v-if="props.loading"
    >
      <div class="i-svg-spinners:180-ring animate-spin"></div>
      <div>{{ props.loadingText }}</div>
    </div>
  </div>
</template>
