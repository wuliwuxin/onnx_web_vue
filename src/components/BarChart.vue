<script setup lang="ts">
import { computed } from 'vue'
import type { ApexOptions } from 'apexcharts'
import { useMediaQuery } from '@vueuse/core'

interface Props {
  data: number[]
  labels: string[]
}
const props = defineProps<Props>()
const isMdScreen = useMediaQuery('(max-width: 767.9px)')

const series = computed(() => {
  return [
    {
      name: '可能性',
      data: props.data
    }
  ]
})

const chartOptions = computed<ApexOptions>(() => {
  return {
    chart: {
      type: 'bar',
      width: '100%',
      height: '100%'
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: 20,
        dataLabels: {
          position: 'top' // top, center, bottom
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => {
        return `${(val * 100).toFixed(2)}%`
      },
      offsetY: -20,
      style: {
        fontSize: '12px',
        colors: ['#304758']
      }
    },
    xaxis: {
      categories: props.labels,
      position: 'bottom',
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      },
      crosshairs: {
        fill: {
          type: 'gradient',
          gradient: {
            colorFrom: '#D8E3F0',
            colorTo: '#BED1E6',
            stops: [0, 100],
            opacityFrom: 0.4,
            opacityTo: 0.5
          }
        }
      },
      tooltip: {
        enabled: true
      }
    },
    yaxis: {
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      },
      labels: {
        show: false,
        formatter: function (val: number) {
          return `${(val * 100).toFixed(2)}%`
        }
      }
    },
    title: {
      text: 'Top5 类别预测结果',
      align: 'center',
      style: {
        color: '#444'
      }
    }
  }
})
</script>
<template>
  <apexchart
    width="100%"
    :height="isMdScreen ? 250 : '100%'"
    type="bar"
    :options="chartOptions"
    :series="series"
  ></apexchart>
</template>
