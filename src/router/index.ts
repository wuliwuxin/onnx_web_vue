import { createRouter, createWebHistory } from 'vue-router'
import OnnxView from '../views/OnnxView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'onnx',
      component: OnnxView
    }
  ]
})

export default router
