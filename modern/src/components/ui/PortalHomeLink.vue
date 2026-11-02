<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });
// Runtime URL: HRM serves the shared corporate Portal marks under the same host.
const logos = {
  light: "/hrm/brand/itp-portal-light-v2.png",
  dark: "/hrm/brand/itp-portal-dark-v2.png",
  compact: "/hrm/brand/itp-mark.svg",
};
</script>

<template>
  <a class="portal-home" :class="{ 'portal-home--compact': compact }"
    href="https://platform.itpmining.kz/" title="ITP Portal" aria-label="ITP Portal">
    <img class="portal-home__full portal-home__light"
      :src="logos.light"
      alt="" aria-hidden="true" width="120" height="31" />
    <img class="portal-home__full portal-home__dark"
      :src="logos.dark"
      alt="" aria-hidden="true" width="120" height="31" />
    <img class="portal-home__mark" :src="logos.compact"
      alt="" aria-hidden="true" width="33" height="25" />
  </a>
</template>

<style scoped>
.portal-home{display:flex;align-items:center;justify-content:flex-start;min-height:64px;
  width:100%;padding:10px 8px;transition:background .15s ease;border-top:1px solid var(--color-stroke);
  text-decoration:none;border-radius:0}
.portal-home:hover{background:var(--color-hover)}
.portal-home:focus-visible{outline:2px solid var(--color-primary);outline-offset:-2px}
.portal-home__full{display:block;max-width:100%;width:120px;height:31px;object-fit:contain;object-position:left center}
.portal-home__dark,.portal-home__mark{display:none}
:global(:root[data-theme="dark"]) .portal-home__light{display:none}
:global(:root[data-theme="dark"]) .portal-home__dark{display:block}
.portal-home--compact{width:40px;min-height:40px;height:40px;justify-content:center;
  padding:5px;border:1px solid var(--color-stroke);border-radius:var(--radius-sm)}
.portal-home--compact .portal-home__full{display:none}
.portal-home--compact .portal-home__mark{display:block;width:29px;height:23px}
@media(prefers-reduced-motion:reduce){.portal-home{transition:none}}
</style>
