<script setup lang="ts">
import {computed} from 'vue'
import {useRouter} from 'vue-router'
import {SiteHeader} from '@itpmining/vue-basic-components'
import {useUiSettings} from '../../stores/uiSettings'
import {commercialT} from '../../commercialTranslations'
import type {InventoryLocale} from '../../i18n'
const ui=useUiSettings(),router=useRouter(),logoUrl=import.meta.env.BASE_URL+'brand/inventory-logo.svg'
const t=(key:string)=>commercialT(ui.locale,key)
const locales=[{value:'ru',label:'RU'},{value:'en',label:'EN'},{value:'ka',label:'GE'}]
const nav=computed(()=>[{href:'/#product',label:t('product')},{href:'/#modules',label:t('features')},{href:'/#demo',label:t('preview')},{href:'/pricing',label:t('plans')},{href:'/legal',label:t('documents')}].map(x=>({...x,href:router.resolve(x.href).href})))
function language(value:string){if(['ru','en','ka'].includes(value))ui.locale=value as InventoryLocale}
function navigate(item:{href:string},event:MouseEvent){if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();const base=router.options.history.base;router.push(base&&item.href.startsWith(base)?item.href.slice(base.length)||'/':item.href)}
</script><template><SiteHeader :home-href="router.resolve('/').href" :home-label="t('brand')" :nav="nav" :login-href="router.resolve('/auth/login').href" :signup-href="router.resolve('/auth/register').href" :login-label="t('signIn')" :signup-label="t('signUp')" :locale="ui.locale" :locales="locales" :language-label="t('language')" :mobile-label="t('features')" :nav-label="t('product')" :mobile-nav-label="t('product')" auto-hide @navigate="navigate" @update:locale="language"><template #brand><img :src="logoUrl" alt="ITP Inventory" width="160" height="36"/></template></SiteHeader></template>
