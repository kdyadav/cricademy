<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const props = defineProps<{ trend: number[]; squad: number }>()

const TURF = '#00a35c'
const MUTED = '#6f7571'
const HAIRLINE = '#e8ebe9'
const FONT = { family: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif", size: 11 }

const data = computed<ChartData<'line'>>(() => ({
  labels: props.trend.map((_, i) => `S${i + 1}`),
  datasets: [
    {
      label: 'Dot-ball %',
      data: props.trend,
      borderColor: TURF,
      backgroundColor: 'rgb(0 163 92 / 0.12)',
      fill: true,
      tension: 0.35,
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: '#fff',
      pointBorderColor: TURF,
      pointBorderWidth: 2,
    },
    {
      label: 'Squad avg',
      data: props.trend.map(() => props.squad),
      borderColor: MUTED,
      borderDash: [4, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
    },
  ],
}))

const options: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400 },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1c1f1d',
      titleFont: FONT,
      bodyFont: FONT,
      padding: 8,
      callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}%` },
    },
  },
  scales: {
    x: { grid: { display: false }, border: { display: false }, ticks: { color: MUTED, font: FONT } },
    y: {
      grid: { color: HAIRLINE },
      border: { display: false },
      ticks: { color: MUTED, font: FONT, maxTicksLimit: 4, callback: (v) => `${v}%` },
    },
  },
}
</script>

<template>
  <div class="h-40" role="img" :aria-label="`Dot-ball percentage over the last ${trend.length} sessions`">
    <Line :data="data" :options="options" />
  </div>
</template>
