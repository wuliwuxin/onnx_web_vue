<script setup lang="ts">
import * as ort from 'onnxruntime-web'
import { ref, computed, onMounted, nextTick } from 'vue'
import { transformImage, preprocess, predict } from '@/utils/runtime'

import BarChart from '@/components/BarChart.vue'
import CardItem from '@/components/CardItem.vue'
import FilePicker from '@/components/FilePicker.vue'
import ListSelect from '@/components/ListSelect.vue'

//需要设置wasmPath，不然vue3会报错
ort.env.wasm.wasmPaths = {
  'ort-wasm.wasm': 'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.14.0/ort-wasm.wasm',
  'ort-wasm-threaded.wasm':
    'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.14.0/ort-wasm-threaded.wasm',
  'ort-wasm-simd.wasm':
    'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.14.0/ort-wasm-simd.wasm',
  'ort-wasm-simd-threaded.wasm':
    'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.14.0/ort-wasm-simd-threaded.wasm'
}

const executionProvider = ref<'wasm' | 'webgl'>('wasm')
const modelUrl = ref<string>('')
const model = ref<ort.InferenceSession | null>(null)
const classIndices = ref<{
  [key: number]: string
} | null>(null)
const inputImageUrl = ref<string>('')

const isLoadingModel = ref(false)
const isLoadingPredict = ref(false)
const canPredict = computed(() => {
  return model.value && classIndices.value
})

const seriesData = ref<number[]>([])
const seriesLabels = ref<string[]>([])
const timeCost = ref<number>(0)

const useCamera = ref(false)

// webcam
const availableDevices = ref<InputDeviceInfo[]>([])
const canvas = ref<HTMLCanvasElement | null>(null)
const ctx = ref<CanvasRenderingContext2D | null>(null)
const globalStream = ref<MediaStream | null>(null)
const constraints = ref({
  audio: false,
  video: { width: 256, height: 256, deviceId: '' }
})
const deviceOptions = computed(() => {
  return availableDevices.value.map((device) => {
    return {
      value: device.deviceId,
      label: device.label
    }
  })
})
const deviceSelected = ref<{
  value: string
  label: string
}>({
  value: '',
  label: ''
})
const isCameraOn = ref(false)

const processFrame = async (ctx: CanvasRenderingContext2D) => {
  if (useCamera.value) {
    const imageData = ctx.getImageData(0, 0, 256, 256)
    const inputTensor = transformImage(imageData, 256, 256)
    const res = await predict(model.value, inputTensor, classIndices.value)
    if (res) {
      timeCost.value = res.timeCost
      seriesData.value = res.data
      seriesLabels.value = res.labels
    }
  } else {
    seriesData.value = []
    seriesLabels.value = []
  }
}

const startCamera = async () => {
  useCamera.value = true
  nextTick(async () => {
    canvas.value = document.getElementById('canvas') as HTMLCanvasElement
    ctx.value = canvas.value.getContext('2d', {
      willReadFrequently: true
    }) as CanvasRenderingContext2D
    if (deviceSelected.value.value !== '') {
      constraints.value.video.deviceId = deviceSelected.value.value
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints.value)
        // @ts-ignore
        window.stream = stream // make variable available to browser console
        const videoTracks = stream.getVideoTracks()
        console.log('Got stream with constraints:', constraints)
        console.log('Using video device: ' + videoTracks[0].label)
        globalStream.value = stream // make variable available to browser console
        const videoElement = document.createElement('video')
        videoElement.srcObject = stream
        videoElement.play()
        isCameraOn.value = true
        const renderFrame = async () => {
          if (canvas.value !== null && ctx.value !== null) {
            ctx.value.drawImage(videoElement, 0, 0, canvas.value.width, canvas.value.height)
            processFrame(ctx.value)
          }
          if (useCamera.value) {
            requestAnimationFrame(renderFrame)
          }
        }
        requestAnimationFrame(renderFrame)
      } catch (error: any) {
        if (error.name === 'ConstraintNotSatisfiedError') {
          console.error('ConstraintNotSatisfiedError error: ' + error.name, error)
        } else if (error.name === 'PermissionDeniedError') {
          console.error(
            'Permissions have not been granted to use your camera and ' +
              'microphone, you need to allow the page access to your devices in ' +
              'order for the demo to work.'
          )
        }
        console.error('getUserMedia error: ' + error.name, error)
      }
    }
  })
}

const stopCamera = (stream: MediaStream | null) => {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop())
  }
  isCameraOn.value = false
  useCamera.value = false
}

const openMediaDevices = async (constraints: MediaStreamConstraints) => {
  return await navigator.mediaDevices.getUserMedia(constraints)
}

onMounted(async () => {
  console.log('获取摄像头列表')
  try {
    const stream = await openMediaDevices({
      audio: false,
      video: true
    })
    // 关闭摄像头
    stopCamera(stream)
    const devices = await navigator.mediaDevices.enumerateDevices()
    devices.forEach(function (device) {
      if (device.kind === 'videoinput' && device.label !== '' && device.deviceId !== '') {
        availableDevices.value.push(device)
      }
    })
    if (availableDevices.value.length > 0) {
      deviceSelected.value = {
        value: availableDevices.value[0].deviceId,
        label: availableDevices.value[0].label
      }
    }
  } catch (error) {
    console.error('Error opening video camera.', error)
  }
})

// execution provider change handler
const executionProviderChangeHandler = async (provider: 'wasm' | 'webgl') => {
  executionProvider.value = provider
  if (modelUrl.value) {
    isLoadingModel.value = true
    model.value = await ort.InferenceSession.create(modelUrl.value, {
      executionProviders: [executionProvider.value]
    })
    isLoadingModel.value = false
  }
}

// model file change handler 这里重要
const modelFileChangeHandler = async (event: Event) => {
  isLoadingModel.value = true
  const model_file = (event.target as HTMLInputElement).files?.[0]
  const model_file_array_buffer = await model_file?.arrayBuffer()
  if (model_file_array_buffer) {
    const model_file_blob = new Blob([model_file_array_buffer])
    const model_url = URL.createObjectURL(model_file_blob)
    modelUrl.value = model_url
    model.value = await ort.InferenceSession.create(model_url, {
      executionProviders: [executionProvider.value]
    })
  }
  isLoadingModel.value = false
}

// classes file change handler
const classesFileChangeHandler = async (event: Event) => {
  const classes_file = (event.target as HTMLInputElement).files?.[0]
  const classes_file_array_buffer = await classes_file?.arrayBuffer()
  if (classes_file_array_buffer) {
    const classes_file_blob = new Blob([classes_file_array_buffer])
    const classes_url = URL.createObjectURL(classes_file_blob)
    const classes_text = await fetch(classes_url).then((response) => response.text())
    classIndices.value = JSON.parse(classes_text)
  }
}

// image file change handler
const imageFileChangeHandler = async (event: Event) => {
  useCamera.value = false
  const image_file = (event.target as HTMLInputElement).files?.[0] ?? null
  if (image_file) {
    seriesData.value = []
    seriesLabels.value = []
    const inputImageBlob = new Blob([image_file])
    inputImageUrl.value = URL.createObjectURL(inputImageBlob)
    isLoadingPredict.value = true
    if (model.value && classIndices.value) {
      const inputTensor = await preprocess(inputImageUrl.value)
      const res = await predict(model.value, inputTensor, classIndices.value)
      if (res) {
        timeCost.value = res.timeCost
        seriesData.value = res.data
        seriesLabels.value = res.labels
      }
    }
    isLoadingPredict.value = false
  }
}

// predict
const imagePredictHandler = async () => {
  const imageUploader = document.getElementById('imageUploader')
  if (imageUploader) {
    imageUploader.click()
  }
}
</script>
<template>
  <main class="w-full flex flex-col gap-4 p-4">
    <section class="grid grid-cols-5 gap-4 <lg:grid-cols-3 <md:grid-cols-2 <sm:grid-cols-1">
      <CardItem title="0. 选择推理硬件">
        <div>
          <input
            id="cpu"
            class="form-radio peer/cpu mb-0.5 mr-2 border-1 border-slate-300 border-solid text-sky-400 focus:ring-sky-300"
            type="radio"
            name="status"
            checked
            @change="executionProviderChangeHandler('wasm')"
          /><label class="font-medium peer-checked/cpu:text-sky-500" for="cpu"
            >CPU - WebAssembly</label
          >
          <br />
          <input
            id="gpu"
            class="form-radio peer/gpu mb-0.5 mr-2 border-1 border-slate-300 border-solid text-sky-400 focus:ring-sky-300"
            type="radio"
            name="status"
            @change="executionProviderChangeHandler('webgl')"
          /><label class="font-medium peer-checked/gpu:text-sky-500" for="gpu">GPU - WebGL</label>
          <br />
          <input
            id="webgpu"
            class="form-radio peer/webgpu mb-0.5 mr-2 border-1 border-slate-300 border-solid text-sky-400 focus:ring-sky-300"
            type="radio"
            name="status"
            @change="executionProviderChangeHandler('webgl')"
          /><label class="font-medium peer-checked/webgpu:text-sky-500" for="webgpu"
            >GPU - WebGPU</label
          >
        </div>
      </CardItem>
      <CardItem title="1. 上传ONNX模型" :loading="isLoadingModel" loading-text="正在加载模型">
        <FilePicker accept=".onnx" name="model" @change="modelFileChangeHandler" />
      </CardItem>
      <CardItem title="2. 上传类别文件">
        <FilePicker accept=".json" name="classes" @change="classesFileChangeHandler" />
      </CardItem>
      <CardItem title="推理预测/单张图像" :loading="isLoadingPredict" loading-text="正在运行推理">
        <input
          type="file"
          accept="image/*"
          name="image"
          id="imageUploader"
          class="hidden"
          @change="imageFileChangeHandler"
        />
        <button
          id="imagePredict"
          @click="imagePredictHandler"
          :title="!canPredict ? '请先上传模型和类别文件' : ''"
          :disabled="!canPredict"
          class="disabled:cursor-disallow w-full border-0 rounded-full px-4 py-2 text-sm font-semibold enabled:cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-200 enabled:bg-teal-50 disabled:text-slate-500 enabled:text-teal enabled:hover:bg-teal-100"
        >
          上传图像推理
        </button>
      </CardItem>
      <CardItem title="推理预测/摄像头实时">
        <ListSelect :options="deviceOptions" v-model="deviceSelected" />
        <button
          v-if="isCameraOn === false"
          class="disabled:cursor-disallow mt-2 w-full border-0 rounded-full px-4 py-2 text-sm font-semibold enabled:cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-200 enabled:bg-teal-50 disabled:text-slate-500 enabled:text-teal enabled:hover:bg-teal-100"
          :disabled="deviceSelected.value === '' || !canPredict"
          :title="!canPredict ? '请先上传模型和类别文件' : ''"
          @click="startCamera"
        >
          启动摄像头
        </button>
        <button
          v-else
          class="disabled:cursor-disallow mt-2 w-full border-0 rounded-full px-4 py-2 text-sm font-semibold enabled:cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-200 enabled:bg-red-50 disabled:text-slate-500 enabled:text-red enabled:hover:bg-red-100"
          @click="stopCamera(globalStream)"
        >
          关闭摄像头
        </button>
      </CardItem>
    </section>
    <section v-if="seriesData.length > 0 && !useCamera">
      <h2 class="mb-2 text-base font-semibold prose prose-slate">
        识别结果(耗时：{{ timeCost }}ms)
      </h2>
      <div class="not-prose flex gap-4 <md:flex-wrap">
        <div class="flex flex-col overflow-hidden rounded bg-white shadow">
          <img :src="inputImageUrl" alt="" class="<md:w-full md:w-256px" />
        </div>
        <div class="flex-1 rounded bg-white p-4 shadow <md:flex-auto">
          <BarChart :data="seriesData" :labels="seriesLabels" />
        </div>
      </div>
    </section>
    <section v-if="useCamera">
      <h2 class="mb-2 text-base font-semibold prose prose-slate">
        摄像头实时推理(耗时：{{ timeCost }}ms)
      </h2>
      <div class="not-prose flex gap-4 <md:flex-wrap">
        <div class="max-w-1/4 flex flex-col overflow-hidden rounded bg-white shadow <md:max-w-full">
          <canvas width="256" height="256" id="canvas"></canvas>
        </div>
        <div class="flex-1 rounded bg-white p-4 shadow <md:flex-auto">
          <BarChart :data="seriesData" :labels="seriesLabels" />
        </div>
      </div>
    </section>
    <section class="w-full">
      <h2 class="mb-2 text-base font-semibold text-slate-700">资源下载</h2>
      <div class="grid grid-cols-3 gap-4 <md:grid-cols-2 <sm:grid-cols-1">
        <article class="w-full rounded bg-white p-4 text-sm text-slate-700 shadow">
          <p class="leading-6">
            ImageNet ONNX 模型：<a
              href="https://zihao-openmmlab.obs.cn-east-3.myhuaweicloud.com/20220716-mmclassification/dataset/fruit30/onnx/resnet18_imagenet.onnx"
              target="_blank"
              class="text-blue-500 no-underline visited:text-blue-700"
              >resnet18_imagenet.onnx</a
            >
          </p>
          <p class="leading-6">
            ImageNet 类别文件：<a
              href="https://zihao-openmmlab.obs.cn-east-3.myhuaweicloud.com/20220716-mmclassification/dataset/fruit30/onnx/imagenet_1000_zh.json"
              target="_blank"
              class="text-blue-500 no-underline visited:text-blue-700"
              >imagenet_1000_zh.json</a
            >
          </p>
          <p class="leading-6">
            Fruit30 ONNX 模型：<a
              href="https://zihao-openmmlab.obs.cn-east-3.myhuaweicloud.com/20220716-mmclassification/dataset/fruit30/onnx/resnet18_fruit30.onnx"
              target="_blank"
              class="text-blue-500 no-underline visited:text-blue-700"
              >resnet18_fruit30.onnx</a
            >
          </p>
          <p class="leading-6">
            Fruit30 类别文件：<a
              href="https://zihao-openmmlab.obs.cn-east-3.myhuaweicloud.com/20220716-mmclassification/dataset/fruit30/onnx/fruit_30_zh.json"
              target="_blank"
              class="text-blue-500 no-underline visited:text-blue-700"
              >fruit_30_zh.json</a
            >
          </p>
        </article>
        <article class="w-full rounded bg-white p-4 text-sm text-slate-700 shadow">
          <p class="leading-6">
            哈士奇：<a
              href="https://zihao-openmmlab.obs.cn-east-3.myhuaweicloud.com/20220716-mmclassification/test/husky1.jpeg"
              target="_blank"
              class="text-blue-500 no-underline visited:text-blue-700"
              >husky1.jpeg</a
            >
          </p>
          <p class="leading-6">
            猕猴桃：<a
              href="https://zihao-openmmlab.obs.myhuaweicloud.com/20220716-mmclassification/test/0818/test_kiwi.jpg"
              target="_blank"
              class="text-blue-500 no-underline visited:text-blue-700"
              >test_kiwi.jpg</a
            >
          </p>
          <p class="leading-6">
            香蕉：<a
              href="https://zihao-openmmlab.obs.myhuaweicloud.com/20220716-mmclassification/test/0818/test_bananan.jpg"
              target="_blank"
              class="text-blue-500 no-underline visited:text-blue-700"
              >test_banana.jpg</a
            >
          </p>
          <p class="leading-6">
            柠檬：<a
              href="https://zihao-openmmlab.obs.myhuaweicloud.com/20220716-mmclassification/test/0818/test_lemon.jpg"
              target="_blank"
              class="text-blue-500 no-underline visited:text-blue-700"
              >test_lemon.jpg</a
            >
          </p>
        </article>
      </div>
    </section>
    <section class="w-full">
      <h2 class="mb-2 text-base font-semibold text-slate-700">更多信息</h2>
      <article class="w-full rounded bg-white p-4 text-sm text-slate-700 shadow">
        <p class="leading-6">
          在浏览器Web前端，使用推理引擎ONNX Runtime的JavaScript
          API，实现图像分类深度学习模型的本地部署和推理预测，可在PC浏览器和手机浏览器中运行。
        </p>
        <p class="leading-6">
          <br />
        </p>
        <p class="leading-6">
          【同济子豪兄】两天搞定图像分类、目标检测、语义分割、实例分割、关键点检测毕业设计
        </p>
        <p class="leading-6">
          代码教程：<a
            href="https://github.com/TommyZihao/Train_Custom_Dataset"
            target="_blank"
            class="text-blue-500 no-underline visited:text-blue-700"
            >https://github.com/TommyZihao/Train_Custom_Dataset</a
          >
        </p>
        <p class="leading-6">
          B站视频合集：<a
            href="https://github.com/TommyZihao/Train_Custom_Dataset"
            target="_blank"
            class="text-blue-500 no-underline visited:text-blue-700"
            >https://space.bilibili.com/1900783</a
          >
        </p>
        <p class="leading-6">
          <br />
        </p>
        <p class="leading-6">
          手机APP、微信小程序、网页开发、服务器部署，公众号 人工智能小技巧
          回复“定制开发”，加助理微信
        </p>
        <p class="leading-6">代码bug江湖救急、论文创新点辅导答疑，可直接B站私信子豪兄</p>
      </article>
    </section>
  </main>
</template>
<style lang="scss" scoped></style>
