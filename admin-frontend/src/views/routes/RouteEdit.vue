<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import type { FormInstance } from "element-plus";
import { ArrowDown, ArrowUp, Delete, Plus } from "@element-plus/icons-vue";
import { routesApi } from "@/api/routes";
import { citiesApi } from "@/api/cities";
import { homeApi } from "@/api/home";
import { readContentValue } from "@/types/common";
import { extractErrorMessage, optionalContent } from "@/utils/errors";
import { useDirtyForm } from "@/composables/useDirtyForm";
import { usePublishCheck } from "@/composables/usePublishCheck";
import { ElMessageBox } from "element-plus";
import ContentInput from "@/components/ContentInput.vue";
import ContentMarkdownEditor from "@/components/ContentMarkdownEditor.vue";
import ImageUpload from "@/components/ImageUpload.vue";
import MediaAssetInput from "@/components/media/MediaAssetInput.vue";
import RouteStopMapPicker from "@/components/routes/RouteStopMapPicker.vue";
import FrontendPagePreview from "@/components/FrontendPagePreview.vue";
import FrontendPreviewDrawer from "@/components/editor/FrontendPreviewDrawer.vue";
import EditorPageHeader from "@/components/editor/EditorPageHeader.vue";
import EditorWorkspace, {
  type EditorWorkspaceTab,
} from "@/components/editor/EditorWorkspace.vue";
import {
  DEFAULT_ROUTE_REGIONS,
  ROUTE_TAG_OPTIONS,
  formatRouteRegionLabel,
  formatRouteTagLabel,
  normalizeRouteTag,
} from "@/constants/guangdongRegions";
import type { RouteRegionConfig } from "@/types/home";
import {
  isIncompleteVideoMedia,
  legacyImageForMedia,
  resolveMediaGallery,
  resolvePrimaryMedia,
} from "@/types/media";

const mobilePreviewVisible = ref(false);

const router = useRouter();
const route = useRoute();
const isEdit = computed(() => Boolean(route.params.id));
const loading = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
const activeWorkspace = ref("hero");

const rules = {
  slug: [
    { required: true, message: "请输入 Slug", trigger: "blur" },
    {
      pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/,
      message: "Slug 必须是 kebab-case",
      trigger: "blur",
    },
  ],
  title: [
    { required: true, message: "请输入路线标题", trigger: "blur" },
  ],
};

const form = reactive<any>({
  slug: "",
  title: "",
  cultureTag: "Bay Area",
  cityName: "",
  citySlugs: [],
  routeRegionKey: "",
  duration: "",
  audience: "",
  summary: "",
  story: "",
  coverImage: "",
  stops: [],
  published: false,
});

const cityOptions = ref<
  Array<{ slug: string; name: string }>
>([]);
const routeRegionOptions = ref<RouteRegionConfig[]>(
  DEFAULT_ROUTE_REGIONS.map((item) => ({ ...item })),
);

const { isDirty, resetDirty, disableDirtyCheck } = useDirtyForm({ form });
const { check: runPublishCheck } = usePublishCheck();

function createStop() {
  return {
    id: `stop-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    sortOrder: form.stops.length,
    time: "",
    isFeatured: form.stops.length === 0,
    stopName: "",
    story: "",
    culturalStory: "",
    details: [],
    image: "",
    primaryMedia: null,
    images: [],
    media: [],
    lat: null,
    lng: null,
    meal: "",
    hotel: "",
    transit: "",
    plan: "",
  };
}

function addStop() {
  form.stops.push(createStop());
  activeWorkspace.value = `stop-${form.stops.length - 1}`;
}

function removeStop(index: number) {
  form.stops.splice(index, 1);
  reindexStops();
  activeWorkspace.value = form.stops.length
    ? `stop-${Math.min(index, form.stops.length - 1)}`
    : "hero";
}

function moveStop(index: number, delta: -1 | 1) {
  const target = index + delta;
  if (target < 0 || target >= form.stops.length) return;
  [form.stops[index], form.stops[target]] = [
    form.stops[target],
    form.stops[index],
  ];
  reindexStops();
}

function reindexStops() {
  form.stops.forEach((stop: any, index: number) => {
    stop.sortOrder = index;
  });
}

function moveActiveStop(delta: -1 | 1) {
  if (activeStopIndex.value < 0) return;
  const currentIndex = activeStopIndex.value;
  moveStop(currentIndex, delta);
  const targetIndex = currentIndex + delta;
  if (targetIndex >= 0 && targetIndex < form.stops.length) {
    activeWorkspace.value = `stop-${targetIndex}`;
  }
}

function addDetail(stop: any) {
  stop.details.push("");
}

function removeDetail(stop: any, index: number | string) {
  stop.details.splice(Number(index), 1);
}

function applyStopCoordinates(payload: {
  index: number;
  lat: number;
  lng: number;
}) {
  const stop = form.stops[payload.index];
  if (!stop) return;
  stop.lat = payload.lat;
  stop.lng = payload.lng;
}

function selectStopFromMap(index: number) {
  if (index < 0 || index >= form.stops.length) return;
  activeWorkspace.value = `stop-${index}`;
}

const workspaceTabs = computed<EditorWorkspaceTab[]>(() => [
  { key: "hero", label: "路线导语" },
  { key: "story", label: "主题叙事" },
  ...form.stops.map((stop: any, index: number) => ({
    key: `stop-${index}`,
    label: readContentValue(stop.stopName) || `站点 ${index + 1}`,
    badge: `#${index + 1}`,
  })),
]);

const activeStopIndex = computed(() => {
  const match = /^stop-(\d+)$/.exec(activeWorkspace.value);
  return match ? Number(match[1]) : -1;
});

const activeStop = computed(() =>
  activeStopIndex.value >= 0 ? form.stops[activeStopIndex.value] : null,
);
const selectedCityCards = computed(() =>
  form.citySlugs
    .map((slug: string) => cityOptions.value.find((item) => item.slug === slug))
    .filter(Boolean),
);

const activeWorkspaceLabel = computed(() => {
  return (
    workspaceTabs.value.find((item) => item.key === activeWorkspace.value)
      ?.label || "路线导语"
  );
});

function applySelectedCitiesToDisplayName() {
  if (!selectedCityCards.value.length) return;
  form.cityName = selectedCityCards.value.map((item: any) => item.name).join(" / ");
}

function fillFromApi(data: any) {
  Object.assign(form, {
    slug: data.slug || "",
    title: readContentValue(data.title),
    cultureTag: normalizeRouteTag(data.cultureTag),
    cityName: readContentValue(data.cityName),
    citySlugs: Array.isArray(data.citySlugs) ? data.citySlugs : [],
    routeRegionKey: data.routeRegionKey || "",
    duration: readContentValue(data.duration),
    audience: readContentValue(data.audience),
    summary: readContentValue(data.summary),
    story: readContentValue(data.story),
    coverImage: data.coverImage || "",
    published: data.published ?? false,
    stops: (data.stops || []).map((stop: any, index: number) => ({
      id: stop.id || `stop-${index}`,
      sortOrder: stop.sortOrder ?? index,
      time: stop.time || "",
      isFeatured: Boolean(stop.isFeatured),
      stopName: readContentValue(stop.stopName),
      story: readContentValue(stop.story),
      culturalStory: readContentValue(stop.culturalStory),
      details: Array.isArray(stop.details) ? stop.details.filter((item: unknown): item is string => typeof item === "string") : [],
      image: stop.image || "",
      primaryMedia: resolvePrimaryMedia(stop.primaryMedia, stop.image || ""),
      images: Array.isArray(stop.images) ? stop.images : [],
      media: resolveMediaGallery(stop.media, stop.images || []),
      lat: stop.lat ?? null,
      lng: stop.lng ?? null,
      meal: readContentValue(stop.meal),
      hotel: readContentValue(stop.hotel),
      transit: readContentValue(stop.transit),
      plan: stop.plan || "",
    })),
  });
}

function toPayload() {
  return {
    slug: form.slug,
    title: form.title,
    cultureTag: normalizeRouteTag(form.cultureTag),
    cityName: form.cityName,
    citySlugs: form.citySlugs,
    routeRegionKey: form.routeRegionKey || undefined,
    duration: form.duration,
    audience: form.audience,
    summary: form.summary,
    story: form.story,
    coverImage: form.coverImage,
    published: form.published,
    stops: form.stops.map((stop: any, index: number) => ({
      sortOrder: index,
      time: stop.time,
      isFeatured: Boolean(stop.isFeatured),
      stopName: stop.stopName,
      story: optionalContent(stop.story),
      culturalStory: optionalContent(stop.culturalStory),
      details: stop.details.filter((detail: unknown): detail is string => typeof detail === "string" && detail.trim().length > 0),
      image: legacyImageForMedia(stop.primaryMedia, stop.image || ""),
      primaryMedia: resolvePrimaryMedia(stop.primaryMedia, stop.image || ""),
      images: stop.images || [],
      media: resolveMediaGallery(stop.media, stop.images || []),
      lat: stop.lat == null ? null : Number(stop.lat),
      lng: stop.lng == null ? null : Number(stop.lng),
      meal: optionalContent(stop.meal),
      hotel: optionalContent(stop.hotel),
      transit: optionalContent(stop.transit),
      plan: stop.plan || "",
    })),
  };
}

watch(
  () => form.stops,
  (stops) => {
    stops.forEach((stop: any) => {
      if (!stop.primaryMedia) return;
      const nextLegacyImage = legacyImageForMedia(stop.primaryMedia, "");
      if (nextLegacyImage !== stop.image) {
        stop.image = nextLegacyImage;
      }
    });
  },
  { deep: true },
);

onMounted(async () => {
  loading.value = true;
  try {
    const [cityRes, homeRes] = await Promise.all([
      citiesApi.getCities({ page: 1, pageSize: 100 }),
      homeApi.getHomeConfig(),
    ]);

    cityOptions.value = (cityRes.data.data.data || []).map((item: any) => ({
      slug: item.slug,
      name: readContentValue(item.name),
    }));

    routeRegionOptions.value = homeRes.data.data.routeRegions?.length
      ? homeRes.data.data.routeRegions
      : DEFAULT_ROUTE_REGIONS.map((item) => ({ ...item }));

    if (isEdit.value) {
      const res = await routesApi.getRoute(route.params.id as string);
      fillFromApi(res.data.data);
    }

    if (!form.stops.length) {
      addStop();
      form.stops = [];
      activeWorkspace.value = "hero";
    }

    resetDirty();
  } catch (error: any) {
    ElMessage.error(extractErrorMessage(error, "加载路线数据失败"));
    router.push("/admin/routes");
  } finally {
    loading.value = false;
  }
});

async function handleSave() {
  try {
    await formRef.value?.validate();
  } catch {
    ElMessage.warning("请先补全必填项");
    return;
  }

  if (
    form.published &&
    form.stops.some((stop: any) => isIncompleteVideoMedia(stop.primaryMedia))
  ) {
    ElMessage.warning("发布路线前，请补全所有视频文件和封面图");
    return;
  }

  // ── Publish pre-check: only when switching to published ──
  if (form.published) {
    const result = runPublishCheck("route", form);

    if (!result.canPublish) {
      ElMessage.error(result.errors[0]);
      return;
    }

    if (result.warnings.length) {
      try {
        await ElMessageBox.confirm(result.warnings.join("\n"), "发布前提示", {
          confirmButtonText: "继续发布",
          cancelButtonText: "返回修改",
          type: "warning",
        });
      } catch {
        return; // user cancelled
      }
    }
  }

  saving.value = true;
  try {
    if (isEdit.value) {
      await routesApi.updateRoute(route.params.id as string, toPayload());
      ElMessage.success("路线已更新");
    } else {
      await routesApi.createRoute(toPayload());
      ElMessage.success("路线已创建");
    }
    disableDirtyCheck();
    router.push("/admin/routes");
  } catch (error: any) {
    ElMessage.error(extractErrorMessage(error, "保存失败"));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="edit-page" v-loading="loading">
    <EditorPageHeader
      :title="isEdit ? '编辑路线' : '新增路线'"
      back-to="/admin/routes"
      :saving="saving"
      :dirty="isDirty"
      @save="handleSave"
      @preview="mobilePreviewVisible = true"
    />

    <div class="editor-shell">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        class="editor-form"
        label-position="top"
      >
        <el-card shadow="never" class="section-card">
          <template #header>基础信息</template>
          <el-row :gutter="16">
            <el-col :xs="24" :sm="12">
              <el-form-item label="Slug" prop="slug">
                <el-input v-model="form.slug" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="路线标题" prop="title">
                <ContentInput v-model="form.title" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :xs="24" :sm="12" :md="8">
              <el-form-item label="文化标签">
                <el-select v-model="form.cultureTag" style="width: 100%">
                  <el-option
                    v-for="item in ROUTE_TAG_OPTIONS"
                    :key="item.value"
                    :label="formatRouteTagLabel(item.value)"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12" :md="8">
              <el-form-item label="路线地区">
                <el-select
                  v-model="form.routeRegionKey"
                  clearable
                  style="width: 100%"
                >
                  <el-option
                    v-for="item in routeRegionOptions"
                    :key="item.key"
                    :label="formatRouteRegionLabel(item)"
                    :value="item.key"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12" :md="8">
              <el-form-item label="发布状态">
                <el-switch
                  v-model="form.published"
                  active-text="已发布"
                  inactive-text="草稿"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header>关联关系与运营信息</template>
          <el-form-item label="关联城市">
            <el-select
              v-model="form.citySlugs"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              style="width: 100%"
            >
              <el-option
                v-for="item in cityOptions"
                :key="item.slug"
                :label="`${item.name} (${item.slug})`"
                :value="item.slug"
              />
            </el-select>
          </el-form-item>
          <div v-if="selectedCityCards.length" class="selected-grid">
            <div
              v-for="city in selectedCityCards"
              :key="city.slug"
              class="selected-card"
            >
              <strong>{{ city.name }}</strong>
              <span>{{ city.slug }}</span>
            </div>
          </div>
          <div class="link-row">
            <el-button text @click="applySelectedCitiesToDisplayName"
              >用关联城市生成前台显示名</el-button
            >
          </div>
          <el-form-item label="前台显示城市名">
            <ContentInput v-model="form.cityName" />
          </el-form-item>
          <el-row :gutter="16">
            <el-col :xs="24" :sm="12">
              <el-form-item label="时长">
                <ContentInput v-model="form.duration" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="适合人群">
                <ContentInput v-model="form.audience" />
              </el-form-item>
            </el-col>
          </el-row>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header>封面图</template>
          <el-form-item label="路线封面">
            <ImageUpload v-model="form.coverImage" module="routes" />
          </el-form-item>
        </el-card>

        <EditorWorkspace
          v-model="activeWorkspace"
          title="路线内容"
          :active-label="activeWorkspaceLabel"
          :tabs="workspaceTabs"
        >
          <template #toolbar>
            <div class="workspace-actions" v-if="activeStop">
              <el-button :icon="Plus" @click="addStop">新增站点</el-button>
              <el-button :icon="ArrowUp" @click="moveActiveStop(-1)"
                >上移</el-button
              >
              <el-button :icon="ArrowDown" @click="moveActiveStop(1)"
                >下移</el-button
              >
              <el-button
                type="danger"
                :icon="Delete"
                @click="removeStop(activeStopIndex)"
                >删除</el-button
              >
            </div>
            <div class="workspace-actions" v-else>
              <el-button :icon="Plus" @click="addStop">新增站点</el-button>
            </div>
          </template>

          <div v-if="activeWorkspace === 'hero'" class="workspace-panel">
            <div class="panel-title">路线导语</div>
            <el-form-item label="摘要">
              <ContentMarkdownEditor v-model="form.summary" :rows="6" />
            </el-form-item>
          </div>

          <div v-else-if="activeWorkspace === 'story'" class="workspace-panel">
            <div class="panel-title">主题叙事</div>
            <el-form-item label="路线故事">
              <ContentMarkdownEditor v-model="form.story" :rows="10" />
            </el-form-item>
          </div>

          <div v-else-if="activeStop" class="workspace-panel">
            <div class="panel-title">站点 {{ activeStopIndex + 1 }}</div>
            <el-row :gutter="16">
              <el-col :xs="24" :sm="12" :md="8">
                <el-form-item label="时间">
                  <el-input v-model="activeStop.time" placeholder="08:30" />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12" :md="16">
                <el-form-item label="站点名称">
                  <ContentInput v-model="activeStop.stopName" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="展示层级">
              <el-switch v-model="activeStop.isFeatured" active-text="重点站：完整展开" inactive-text="普通站：紧凑展示" />
            </el-form-item>
            <el-form-item label="站点主媒体">
              <MediaAssetInput
                v-model="activeStop.primaryMedia"
                :legacy-image="activeStop.image"
                module="routes"
                entity-type="route-stop"
              />
            </el-form-item>
            <el-form-item label="站点图片集">
              <ImageUpload
                v-model="activeStop.images"
                multiple
                :limit="10"
                module="routes"
              />
            </el-form-item>
            <el-form-item label="地图打点">
              <RouteStopMapPicker
                :stops="form.stops"
                :active-index="activeStopIndex"
                :height="320"
                @select="selectStopFromMap"
                @update:coordinates="applyStopCoordinates"
              />
            </el-form-item>
            <el-row :gutter="16">
              <el-col :xs="24" :sm="12">
                <el-form-item label="纬度">
                  <el-input-number
                    v-model="activeStop.lat"
                    :precision="6"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="经度">
                  <el-input-number
                    v-model="activeStop.lng"
                    :precision="6"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="现场故事">
              <ContentMarkdownEditor v-model="activeStop.story" :rows="6" />
            </el-form-item>
            <el-form-item label="文化解读">
              <ContentMarkdownEditor
                v-model="activeStop.culturalStory"
                :rows="6"
              />
            </el-form-item>
            <el-form-item label="站点细节">
              <div class="detail-list">
                <div
                  v-for="(_, index) in activeStop.details"
                  :key="index"
                  class="detail-row"
                >
                  <ContentInput v-model="activeStop.details[index]" />
                  <el-button
                    text
                    type="danger"
                    @click="removeDetail(activeStop, index)"
                    >删除</el-button
                  >
                </div>
                <el-button :icon="Plus" @click="addDetail(activeStop)"
                  >新增细节</el-button
                >
              </div>
            </el-form-item>
            <el-form-item label="行程规划">
              <el-input
                v-model="activeStop.plan"
                type="textarea"
                :rows="2"
                placeholder="简要描述该站点的行程安排或体验建议"
              />
            </el-form-item>
            <el-row :gutter="16">
              <el-col :xs="24" :sm="12" :md="8">
                <el-form-item label="餐饮">
                  <ContentInput v-model="activeStop.meal" />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12" :md="8">
                <el-form-item label="住宿">
                  <ContentInput v-model="activeStop.hotel" />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12" :md="8">
                <el-form-item label="交通">
                  <ContentInput v-model="activeStop.transit" />
                </el-form-item>
              </el-col>
            </el-row>
          </div>
        </EditorWorkspace>
      </el-form>

      <FrontendPagePreview type="route" :model="form" />
    </div>

    <FrontendPreviewDrawer
      v-model="mobilePreviewVisible"
      type="route"
      :model="form"
    />
  </div>
</template>

<style scoped>
@import "@/assets/editor-common.css";

.link-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.workspace-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-list {
  display: grid;
  gap: 10px;
}

.detail-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
}

/* Narrow screens: the second column is the delete button, so the detail row
   stacks and the input keeps its full width. */
@media (max-width: 768px) {
  .detail-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
