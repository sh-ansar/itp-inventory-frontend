<script setup lang="ts">
import { Button } from '@itpmining/vue-basic-components'
withDefaults(defineProps<{variant?:'primary'|'secondary'|'danger';disabled?:boolean;type?:'button'|'submit'|'reset';iconOnly?:boolean}>(),{variant:'primary',type:'button',disabled:false,iconOnly:false})
</script>
<template><Button :type="type" :disabled="disabled" :color="variant" class="base-button" :class="{'button--icon-only':iconOnly}"><slot/></Button></template>
