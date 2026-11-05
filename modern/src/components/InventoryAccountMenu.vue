<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import {
  BellOff, Building2, Check, ChevronDown, ChevronRight, ClipboardCheck,
  LayoutDashboard, LogOut, Package, ShieldCheck, UsersRound, Wrench, X,
} from "lucide-vue-next";
import type { InventoryUser, CompanyAccess } from "../api/session";
import type { InventoryLocale } from "../i18n";

const props = defineProps<{
  user: InventoryUser;
  locale: InventoryLocale;
  companies: CompanyAccess[];
  companyId: string;
  admin: boolean;
  signoutBusy: boolean;
}>();
const emit = defineEmits<{ "update:companyId": [id: string]; logout: [] }>();
const root = ref<HTMLElement | null>(null);
const opened = ref(false);
const expanded = ref<"status" | "company" | "system" | null>(null);
const presence = ref<"online" | "offline">("online");
const muted = ref(false);
const route = useRoute();
const dict = {
  ru: {
    account:"Аккаунт", status:"Статус",online:"Онлайн",offline:"Офлайн",
    company:"Компания",system:"Система",portal:"Портал",hrm:"Кадры",
    inventory:"Инвентаризация",mro:"ТОиР",mute:"Отключить уведомления",
    companySettings:"Настройки компании",admin:"Супер-админка",logout:"Выход",
    local:"Пока только локальная настройка этого браузера",close:"Закрыть",noCompanies:"Нет доступных компаний",
  },
  en: {
    account:"Account", status:"Status",online:"Online",offline:"Offline",
    company:"Company",system:"System",portal:"Portal",hrm:"HRM",
    inventory:"Inventory",mro:"Maintenance",mute:"Mute notifications",
    companySettings:"Company settings",admin:"Platform admin",logout:"Sign out",
    local:"For now, this setting applies only to this browser",close:"Close",noCompanies:"No available companies",
  },
  ka: {
    account:"ანგარიში",status:"სტატუსი",online:"ონლაინ",offline:"ოფლაინ",
    company:"კომპანია",system:"სისტემა",portal:"პორტალი",hrm:"კადრები",
    inventory:"ინვენტარიზაცია",mro:"ტექნიკური მომსახურება",mute:"შეტყობინებების გამორთვა",
    companySettings:"კომპანიის პარამეტრები",admin:"პლატფორმის ადმინისტრირება",logout:"გასვლა",
    local:"ჯერჯერობით პარამეტრი მხოლოდ ამ ბრაუზერში მოქმედებს",close:"დახურვა",noCompanies:"კომპანიები არ არის",
  },
} as const;
const tr = computed(() => dict[props.locale]);
const activeCompany = computed(() => props.companies.find(c => c.id === props.companyId));
const initials = computed(() => props.user.name.trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join("") || "IT");
const canManageCompany = computed(() => activeCompany.value?.role_code === "company_admin");
const systems = [
  { id:"portal",href:"/",icon:LayoutDashboard },
  { id:"hrm",href:"/hrm/",icon:UsersRound },
  { id:"inventory",href:"/inventory/",icon:Package },
  { id:"mro",href:"/mro/",icon:Wrench },
] as const;
function close(){opened.value=false;expanded.value=null;}
function toggle(what:"status"|"company"|"system"){expanded.value=expanded.value===what?null:what;}
function clickOutside(event:PointerEvent){
  if(!(event.target instanceof Node) || !root.value?.contains(event.target))close();
}
function onKey(event:KeyboardEvent){
  if(event.key === "Escape" && opened.value){event.preventDefault();close();}
}
function changeCompany(id:string){
  if(!props.companies.some(company => company.id===id))return;
  emit("update:companyId",id);
  expanded.value=null;
  close();
}
function toggleMute(){
  muted.value=!muted.value;
  try{sessionStorage.setItem("inventory-header-notifications-muted",String(muted.value));}catch{}
}
onMounted(()=>{
  try{muted.value=sessionStorage.getItem("inventory-header-notifications-muted")==="true";}catch{}
  document.addEventListener("pointerdown",clickOutside);
  window.addEventListener("keydown",onKey);
});
onBeforeUnmount(()=>{
  document.removeEventListener("pointerdown",clickOutside);
  window.removeEventListener("keydown",onKey);
});
watch(()=>route.fullPath,close);
</script>

<template>
  <div ref="root" class="inventory-account-anchor">
    <button class="inventory-account-trigger" type="button"
      :aria-label="tr.account" :aria-expanded="opened" aria-haspopup="dialog"
      aria-controls="inventory-account-panel" @click="opened=!opened;expanded=null">
      <span class="inventory-avatar">{{ initials }}</span>
      <span class="inventory-account-copy"><strong>{{ user.name }}</strong>
        <small>{{ activeCompany?.name || tr.company }}</small></span>
      <ChevronDown :size="15" aria-hidden="true"/>
    </button>
    <section v-if="opened" id="inventory-account-panel" class="inventory-account-popover"
      role="dialog" :aria-label="tr.account">
      <header class="inventory-pop-heading">
        <span class="inventory-avatar">{{ initials }}</span>
        <span class="inventory-account-copy"><strong>{{ user.name }}</strong>
          <small>{{ activeCompany?.name || tr.company }}</small></span>
        <button class="inventory-close" type="button" :aria-label="tr.close" @click="close">
          <X :size="18" aria-hidden="true"/>
        </button>
      </header>
      <div class="inventory-pop-choosers">
        <div>
          <button class="inventory-chooser" type="button" :aria-label="tr.status"
            :aria-expanded="expanded==='status'" @click="toggle('status')">
            <span class="inventory-presence" :class="{offline:presence==='offline'}"/>
            {{ tr[presence] }}<ChevronDown :size="16" class="inventory-end" aria-hidden="true"/>
          </button>
          <div v-if="expanded==='status'" class="inventory-pop-options">
            <button v-for="state in (['online','offline'] as const)" :key="state"
              type="button" :aria-pressed="presence===state" @click="presence=state;expanded=null">
              <span class="inventory-presence" :class="{offline:state==='offline'}"/>
              {{ tr[state] }}<Check v-if="presence===state" :size="15" class="inventory-end"/>
            </button>
            <small>{{ tr.local }}</small>
          </div>
        </div>
        <div>
          <button class="inventory-chooser" type="button" :aria-label="tr.company"
            :aria-expanded="expanded==='company'" @click="toggle('company')">
            <Building2 :size="18" class="inventory-accent" aria-hidden="true"/>
            <span class="inventory-ellipsis">{{ activeCompany?.name || tr.company }}</span>
            <ChevronDown :size="16" class="inventory-end" aria-hidden="true"/>
          </button>
          <div v-if="expanded==='company'" class="inventory-pop-options">
            <small v-if="!companies.length">{{ tr.noCompanies }}</small>
            <button v-for="company in companies" :key="company.id" type="button"
              :aria-pressed="company.id===companyId" @click="changeCompany(company.id)">
              <Building2 :size="17"/><span class="inventory-ellipsis">{{ company.name }}</span>
              <Check v-if="company.id===companyId" :size="15" class="inventory-end"/>
            </button>
          </div>
        </div>
        <div>
          <button class="inventory-chooser" type="button" :aria-label="tr.system"
            :aria-expanded="expanded==='system'" @click="toggle('system')">
            <ClipboardCheck :size="18" class="inventory-accent" aria-hidden="true"/>
            {{ tr.inventory }}<ChevronDown :size="16" class="inventory-end" aria-hidden="true"/>
          </button>
          <div v-if="expanded==='system'" class="inventory-pop-options">
            <a v-for="sys in systems" :key="sys.id" :href="sys.href"
              :aria-current="sys.id==='inventory'?'page':undefined">
              <component :is="sys.icon" :size="17" aria-hidden="true"/>
              {{ tr[sys.id] }}<Check v-if="sys.id==='inventory'" :size="15" class="inventory-end"/>
            </a>
          </div>
        </div>
      </div>
      <div class="inventory-pop-actions">
        <button class="inventory-action" type="button" role="switch"
          :aria-checked="muted" @click="toggleMute">
          <BellOff :size="18" aria-hidden="true"/><span>{{ tr.mute }}</span>
          <span class="inventory-switch" :class="{on:muted}"><i/></span>
        </button>
        <RouterLink v-if="canManageCompany" class="inventory-action" to="/company-settings" @click="close">
          <Building2 :size="18" aria-hidden="true"/><span>{{ tr.companySettings }}</span>
          <ChevronRight :size="15" class="inventory-end"/>
        </RouterLink>
        <RouterLink v-if="admin" class="inventory-action" to="/admin" @click="close">
          <ShieldCheck :size="18" aria-hidden="true"/><span>{{ tr.admin }}</span>
          <ChevronRight :size="15" class="inventory-end"/>
        </RouterLink>
      </div>
      <footer class="inventory-pop-footer">
        <button class="inventory-signout" type="button" :disabled="signoutBusy" @click="close();emit('logout')">
          <LogOut :size="17" aria-hidden="true"/>{{ tr.logout }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.inventory-account-anchor{position:relative;flex:none;min-width:0}
.inventory-account-trigger{display:flex;align-items:center;gap:9px;height:40px;max-width:224px;
 padding:3px 7px;border:1px solid transparent;border-radius:9px;background:transparent;
 color:var(--color-text);font:inherit;cursor:pointer;text-align:left}
.inventory-account-trigger:hover,.inventory-account-trigger[aria-expanded="true"]{
 background:var(--color-hover);border-color:var(--color-stroke)}
.inventory-avatar{display:grid;place-items:center;flex:0 0 34px;width:34px;height:34px;
 border-radius:50%;border:1px solid var(--color-primary-stroke);
 background:var(--color-accent-soft);color:var(--color-primary);font-size:11px;font-weight:700}
.inventory-account-copy{display:grid;gap:2px;min-width:0;flex:1}
.inventory-account-copy strong,.inventory-account-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.inventory-account-copy strong{font-size:12px;font-weight:650}
.inventory-account-copy small{font-size:11px;color:var(--color-muted)}
.inventory-account-popover{position:absolute;right:0;top:calc(100% + 12px);z-index:140;
 width:min(350px,calc(100vw - 24px));max-height:calc(100dvh - 85px);overflow-y:auto;
 border:1px solid var(--color-stroke);border-radius:12px;padding:12px;
 background:rgba(255,255,255,.88);
 background:color-mix(in srgb,var(--color-surface-raised) 85%,transparent);
 -webkit-backdrop-filter:blur(16px) saturate(1.18);backdrop-filter:blur(16px) saturate(1.18);
 color:var(--color-text);box-shadow:0 14px 36px rgba(13,40,56,.16)}
.inventory-pop-heading{display:flex;align-items:center;gap:9px;padding:4px 4px 14px;border-bottom:1px solid var(--color-stroke)}
.inventory-close{display:grid;place-items:center;width:29px;height:29px;margin-left:auto;
 border:0;border-radius:6px;background:transparent;color:var(--color-muted);font-size:18px;cursor:pointer}
.inventory-pop-choosers{display:grid;gap:6px;padding:13px 0;border-bottom:1px solid var(--color-stroke)}
.inventory-chooser{display:flex;align-items:center;gap:10px;width:100%;min-height:42px;padding:9px 11px;
 border:1px solid var(--color-stroke);border-radius:8px;background:var(--color-surface);
 color:var(--color-text);font:inherit;font-size:13px;text-align:left;cursor:pointer}
.inventory-chooser:hover{border-color:var(--color-primary-stroke)}
.inventory-ellipsis{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.inventory-end{margin-left:auto;flex:none;color:var(--color-muted)}
.inventory-accent{color:var(--color-primary)}
.inventory-presence{display:block;flex:0 0 8px;width:8px;height:8px;border-radius:50%;background:#15a552}
.inventory-presence.offline{background:#a9b9c2}
.inventory-pop-options{display:grid;gap:1px;padding:4px;background:var(--color-surface);
 border:1px solid var(--color-stroke);border-radius:8px}
.inventory-pop-options button,.inventory-pop-options a{display:flex;align-items:center;gap:10px;
 width:100%;min-height:37px;border:0;border-radius:6px;padding:8px 10px;background:transparent;
 font:inherit;font-size:12px;color:var(--color-text);text-decoration:none;text-align:left;cursor:pointer}
.inventory-pop-options button:hover,.inventory-pop-options a:hover{background:var(--color-hover)}
.inventory-pop-options small{padding:5px 8px;font-size:11px;color:var(--color-muted)}
.inventory-pop-actions{display:grid;gap:1px;padding:11px 0}
.inventory-action{display:flex;align-items:center;gap:11px;width:100%;min-height:43px;padding:9px;
 border:0;border-radius:7px;background:transparent;color:var(--color-text);
 font:inherit;font-size:12px;font-weight:550;text-decoration:none;cursor:pointer}
.inventory-action:hover{background:var(--color-hover)}
.inventory-action>span:nth-child(2){flex:1}
.inventory-action>svg:first-child{color:var(--color-muted)}
.inventory-switch{display:flex;align-items:center;flex:0 0 31px;width:31px;height:18px;
 padding:2px;border-radius:16px;background:var(--color-stroke)}
.inventory-switch i{display:block;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 3px #0002}
.inventory-switch.on{background:var(--color-primary)}
.inventory-switch.on i{transform:translateX(13px)}
.inventory-pop-footer{border-top:1px solid var(--color-stroke);padding-top:11px}
.inventory-signout{display:flex;align-items:center;justify-content:center;gap:8px;
 width:100%;min-height:38px;border:1px solid var(--color-stroke);border-radius:8px;
 background:var(--color-surface);color:var(--color-text);font:inherit;font-size:12px;font-weight:650;cursor:pointer}
.inventory-signout:hover{border-color:var(--color-primary-stroke);color:var(--color-primary)}
.inventory-account-trigger:focus-visible,.inventory-account-popover a:focus-visible,
.inventory-account-popover button:focus-visible{outline:2px solid var(--color-primary);outline-offset:2px}
@media(max-width:800px){.inventory-account-trigger{width:44px;padding:4px}
 .inventory-account-trigger>.inventory-account-copy,.inventory-account-trigger>svg{display:none}}
</style>
