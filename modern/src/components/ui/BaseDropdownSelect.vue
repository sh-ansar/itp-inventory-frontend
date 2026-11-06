<script setup lang="ts">
import { computed } from 'vue'
import { UnifiedSelect } from '@itpmining/vue-basic-components'
export interface SelectOption { value:string;label:string;disabled?:boolean }
const props=withDefaults(defineProps<{modelValue:string;options:SelectOption[];label:string;placeholder?:string;locale?:'ru'|'en'|'ka';searchable?:boolean;disabled?:boolean}>(),{locale:'ru',searchable:false,disabled:false})
const emit=defineEmits<{'update:modelValue':[value:string];change:[value:string]}>()
const text=computed(()=>props.locale==='en'?{placeholder:'Select',search:'Search',empty:'No results'}:props.locale==='ka'?{placeholder:'არჩევა',search:'ძიება',empty:'არ მოიძებნა'}:{placeholder:'Выбрать',search:'Поиск',empty:'Ничего не найдено'})
function change(value:unknown){const next=String(value??'');if(next!==props.modelValue){emit('update:modelValue',next);emit('change',next)}}
</script><template><div class="base-dropdown-select"><select :class="$attrs.class" :aria-label="label || undefined" :value="modelValue" :disabled="disabled" tabindex="-1" aria-hidden="true" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none" @change="change(($event.target as HTMLSelectElement).value)"><option v-for="option in options" :key="option.value" :value="option.value" :disabled="option.disabled">{{option.label}}</option></select><UnifiedSelect class="dropdown-trigger" :model-value="modelValue" :options="options" value-key="value" label-key="label" :label="label" hide-label :placeholder="placeholder||text.placeholder" :search-placeholder="text.search" :empty-text="text.empty" :searchable="searchable" :clearable="false" :disabled="disabled" @update:model-value="change"/></div></template>
