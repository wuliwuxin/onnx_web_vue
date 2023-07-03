<script setup lang="ts">
interface Props {
  accept?: string
  name: string
}
const props = withDefaults(defineProps<Props>(), {
  accept: '*' // 默认接受所有文件
})

const emit = defineEmits<{
  (e: 'file-change', value: Event): void
}>()
</script>
<template>
  <input
    type="file"
    :accept="props.accept"
    :name="props.name"
    @change="emit('file-change', $event)"
    class="block text-slate-500 file:cursor-pointer file:border-0 file:rounded-full file:bg-lightBlue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-lightBlue hover:file:bg-lightBlue-100"
  />
</template>
