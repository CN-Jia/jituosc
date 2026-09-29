<template>
  <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" fill="none" xmlns="http://www.w3.org/2000/svg" class="jt-logo">
    <defs>
      <linearGradient id="jtg2" x1="0" y1="0" :x2="size" :y2="size" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#00d4ff"/>
        <stop offset="100%" stop-color="#a855f7"/>
      </linearGradient>
      <filter id="jtglow2" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <polygon
      :points="`${s/2},${s*.06} ${s*.89},${s*.28} ${s*.89},${s*.72} ${s/2},${s*.94} ${s*.11},${s*.72} ${s*.11},${s*.28}`"
      fill="#050d1a" stroke="url(#jtg2)" stroke-width="1.5" filter="url(#jtglow2)"
    />
    <polygon
      :points="`${s/2},${s*.19} ${s*.78},${s*.35} ${s*.78},${s*.65} ${s/2},${s*.81} ${s*.22},${s*.65} ${s*.22},${s*.35}`"
      fill="none" stroke="rgba(0,212,255,0.18)" stroke-width="0.75"
    />
    <circle :cx="s/2"   :cy="s*.06" r="1.8" fill="#00d4ff" opacity="0.9"/>
    <circle :cx="s*.89" :cy="s*.28" r="1.4" fill="#00d4ff" opacity="0.5"/>
    <circle :cx="s*.89" :cy="s*.72" r="1.4" fill="#a855f7" opacity="0.5"/>
    <circle :cx="s/2"   :cy="s*.94" r="1.8" fill="#a855f7" opacity="0.9"/>
    <circle :cx="s*.11" :cy="s*.72" r="1.4" fill="#a855f7" opacity="0.5"/>
    <circle :cx="s*.11" :cy="s*.28" r="1.4" fill="#00d4ff" opacity="0.5"/>
    <text
      :x="s/2" :y="s*.64"
      font-family="'Arial Black',Arial,sans-serif"
      font-weight="900"
      :font-size="s*.38"
      fill="url(#jtg2)"
      text-anchor="middle"
      letter-spacing="-1"
    >JT</text>
  </svg>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ size?: number }>(), { size: 32 })
const s = props.size
</script>

<style scoped>
.jt-logo { display: block; flex-shrink: 0; }
</style>
