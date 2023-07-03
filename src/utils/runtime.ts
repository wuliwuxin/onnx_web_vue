import { Tensor, InferenceSession } from 'onnxruntime-web'
import ndarray from 'ndarray'
import ops from 'ndarray-ops'
import _ from 'lodash'
import { softmax } from '@/utils/math'

// transform image
export const transformImage = (imageData: ImageData, width: number, height: number) => {
  // convert to tensor
  const dataTensor = ndarray(new Float32Array(imageData.data), [width, height, 4])
  const dataProcessedTensor = ndarray(new Float32Array(width * height * 3), [1, 3, width, height])
  // normalize
  ops.assign(dataProcessedTensor.pick(0, 0, null, null), dataTensor.pick(null, null, 0))
  ops.assign(dataProcessedTensor.pick(0, 1, null, null), dataTensor.pick(null, null, 1))
  ops.assign(dataProcessedTensor.pick(0, 2, null, null), dataTensor.pick(null, null, 2))
  ops.divseq(dataProcessedTensor, 255)
  ops.subseq(dataProcessedTensor.pick(0, 0, null, null), 0.485)
  ops.subseq(dataProcessedTensor.pick(0, 1, null, null), 0.456)
  ops.subseq(dataProcessedTensor.pick(0, 2, null, null), 0.406)
  ops.divseq(dataProcessedTensor.pick(0, 0, null, null), 0.229)
  ops.divseq(dataProcessedTensor.pick(0, 1, null, null), 0.224)
  ops.divseq(dataProcessedTensor.pick(0, 2, null, null), 0.225)
  const tensor = new Tensor('float32', new Float32Array(width * height * 3), [1, 3, width, height])
  ;(tensor.data as Float32Array).set(dataProcessedTensor.data)
  return tensor
}

// preprocess image
export const preprocess = async (inputImageUrl: string) => {
  const width = 256
  const height = 256
  // resize
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = inputImageUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.drawImage(image, 0, 0, width, height) //用的Keras
  const imageData = ctx.getImageData(0, 0, width, height)
  if (imageData) {
    return transformImage(imageData, width, height)
  } else {
    return null
  }
}

// postprocess
export const postprocess = (
  output: Tensor,
  classIndices: { [key: number]: string },
  k: number = 5
) => {
  const outputData = output.data as Float32Array
  if (!outputData || outputData.length === 0) {
    return []
  }
  const outputSoftmax = softmax(Array.prototype.slice.call(outputData))
  const probs = _.isTypedArray(outputSoftmax)
    ? Array.prototype.slice.call(outputSoftmax)
    : outputSoftmax

  const sorted = _.reverse(
    _.sortBy(
      probs.map((prob: any, index: number) => [prob, index]),
      (probIndex: any[]) => probIndex[0]
    )
  )
  const topK = _.take(sorted, k).map((probIndex: any[]) => {
    return {
      class: classIndices[probIndex[1]] ?? '',
      probability: probIndex[0]
    }
  })
  return topK
}

// predict
export const predict = async (
  model: InferenceSession | null,
  inputTensor: Tensor | null,
  classIndices: { [key: number]: string } | null
) => {
  if (model && inputTensor && classIndices) {
    const startTime = new Date().getTime()
    const output = await model.run({ input: inputTensor })
    const results = postprocess(output.output, classIndices, 5)
    if (results.length > 0) {
      return {
        data: results.map((result) => result.probability),
        labels: results.map((result) => result.class),
        timeCost: new Date().getTime() - startTime
      }
    }
    return null
  }
  return null
}
