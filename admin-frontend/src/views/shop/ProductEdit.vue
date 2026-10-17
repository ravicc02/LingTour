<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import type { FormInstance } from "element-plus";
import { citiesApi } from "@/api/cities";
import { collectionsApi } from "@/api/collections";
import { productsApi } from "@/api/products";
import { readContentValue } from "@/types/common";
import { extractErrorMessage, optionalContent } from "@/utils/errors";
import { useDirtyForm } from "@/composables/useDirtyForm";
import EditorPageHeader from "@/components/editor/EditorPageHeader.vue";
import EditorWorkspace, {
  type EditorWorkspaceTab,
} from "@/components/editor/EditorWorkspace.vue";
import FrontendPagePreview from "@/components/FrontendPagePreview.vue";
import FrontendPreviewDrawer from "@/components/editor/FrontendPreviewDrawer.vue";
import ContentInput from "@/components/ContentInput.vue";
import ContentMarkdownEditor from "@/components/ContentMarkdownEditor.vue";
import ImageUpload from "@/components/ImageUpload.vue";
import MediaAssetInput from "@/components/media/MediaAssetInput.vue";
import {
  isIncompleteVideoMedia,
  legacyImageForMedia,
  resolveMediaGallery,
  resolvePrimaryMedia,
} from "@/types/media";

const route = useRoute();
const router = useRouter();
const isEdit = computed(() => Boolean(route.params.id));
const saving = ref(false);
const loading = ref(false);
const mobilePreviewVisible = ref(false);
const formRef = ref<FormInstance>();
const activeWorkspace = ref("story");
const collectionOptions = ref<{ id: string; title: string }[]>([]);
const cityOptions = ref<{ slug: string; name: string; adcode: number }[]>([]);

const rules = {
  slug: [
    { required: true, message: "请输入 Slug", trigger: "blur" },
    {
      pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/,
      message: "Slug 必须是 kebab-case",
      trigger: "blur",
    },
  ],
  name: [
    { required: true, message: "请输入商品名称", trigger: "blur" },
  ],
  price: [{ required: true, message: "请输入价格", trigger: "blur" }],
};

const emptyOriginTrace = () => ({
  location: "",
  citySlug: "",
  cityName: "",
  materialSource: "",
  craftTradition: "",
  process: "",
  mapAdcode: 0,
});

const form = reactive<any>({
  slug: "",
  name: "",
  collectionId: "",
  price: 0,
  currency: "SGD",
  tag: "",
  image: "",
  primaryMedia: null,
  story: "",
  material: "",
  dimensions: "",
  origin: "",
  care: "",
  gallery: [],
  galleryMedia: [],
  stock: 0,
  published: false,
  originTrace: emptyOriginTrace(),
});

const { isDirty, resetDirty, disableDirtyCheck } = useDirtyForm({ form });

const previewMeta = computed(() => ({
  collectionTitle:
    collectionOptions.value.find((item) => item.id === form.collectionId)
      ?.title || "",
}));

const workspaceTabs = computed<EditorWorkspaceTab[]>(() => [
  { key: "story", label: "商品故事" },
  { key: "details", label: "商品细节" },
]);

const activeWorkspaceLabel = computed(() => {
  return (
    workspaceTabs.value.find((item) => item.key === activeWorkspace.value)
      ?.label || "商品故事"
  );
});

async function fetchCollections() {
  const res = await collectionsApi.getCollections({ page: 1, pageSize: 100 });
  collectionOptions.value = (res.data.data.data || []).map((item: any) => ({
    id: item.id,
    title: readContentValue(item.title),
  }));
}

async function fetchCities() {
  const res = await citiesApi.getCities({ page: 1, pageSize: 200 });
  cityOptions.value = (res.data.data.data || []).map((item: any) => ({
    slug: item.slug,
    name: readContentValue(item.name) || item.slug,
    adcode: Number(item.adcode || 0),
  }));
}

function handleOriginCityChange(slug: string) {
  const city = cityOptions.value.find((item) => item.slug === slug);
  if (!city) return;
  form.originTrace.citySlug = city.slug;
  form.originTrace.cityName = city.name;
  form.originTrace.mapAdcode = city.adcode;
}

function fillFromApi(data: any) {
  Object.assign(form, {
    slug: data.slug || "",
    name: readContentValue(data.name),
    collectionId: data.collectionId || data.collection?.id || "",
    price: Number(data.price || 0),
    currency: data.currency || "SGD",
    tag: readContentValue(data.tag),
    image: data.image || "",
    primaryMedia: resolvePrimaryMedia(data.primaryMedia, data.image || ""),
    story: readContentValue(data.story),
    material: readContentValue(data.material),
    dimensions: readContentValue(data.dimensions),
    origin: readContentValue(data.origin),
    care: readContentValue(data.care),
    gallery: data.gallery || [],
    galleryMedia: resolveMediaGallery(data.galleryMedia, data.gallery || []),
    stock: data.stock ?? 0,
    published: data.published ?? false,
    originTrace: { ...emptyOriginTrace(), ...(data.originTrace || {}) },
  });
}

function toPayload() {
  const primaryMedia = resolvePrimaryMedia(form.primaryMedia, form.image);
  return {
    slug: form.slug,
    name: form.name,
    collectionId: form.collectionId || undefined,
    price: Number(form.price || 0),
    currency: form.currency,
    tag: form.tag,
    image: legacyImageForMedia(primaryMedia, form.image),
    primaryMedia,
    story: form.story,
    material: optionalContent(form.material),
    dimensions: optionalContent(form.dimensions),
    origin: optionalContent(form.origin),
    care: optionalContent(form.care),
    gallery: form.gallery,
    galleryMedia: resolveMediaGallery(form.galleryMedia, form.gallery),
    stock: Number(form.stock || 0),
    published: form.published,
    originTrace: form.originTrace,
  };
}

watch(
  () => form.primaryMedia,
  (value) => {
    if (!value) return;
    const nextLegacyImage = legacyImageForMedia(value, "");
    if (nextLegacyImage !== form.image) {
      form.image = nextLegacyImage;
    }
  },
  { deep: true },
);

onMounted(async () => {
  loading.value = true;
  try {
    await Promise.all([fetchCollections(), fetchCities()]);
    const id = route.params.id as string;
    if (id) {
      const res = await productsApi.getProduct(id);
      fillFromApi(res.data.data);
    }
    resetDirty();
  } catch (error: any) {
    ElMessage.error(extractErrorMessage(error, "加载商品失败"));
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

  if (form.published && isIncompleteVideoMedia(form.primaryMedia)) {
    ElMessage.warning("发布视频商品前，请补全视频文件和封面图");
    return;
  }

  saving.value = true;
  try {
    if (isEdit.value) {
      await productsApi.updateProduct(route.params.id as string, toPayload());
      ElMessage.success("商品已更新");
    } else {
      await productsApi.createProduct(toPayload());
      ElMessage.success("商品已创建");
    }
    disableDirtyCheck();
    router.push("/admin/shop/products");
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
      :title="isEdit ? '编辑商品' : '新增商品'"
      back-to="/admin/shop/products"
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
              <el-form-item label="所属系列">
                <el-select
                  v-model="form.collectionId"
                  clearable
                  style="width: 100%"
                >
                  <el-option
                    v-for="item in collectionOptions"
                    :key="item.id"
                    :label="item.title"
                    :value="item.id"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="商品名称" prop="name">
            <ContentInput v-model="form.name" />
          </el-form-item>
          <el-form-item label="商品标签">
            <ContentInput v-model="form.tag" />
          </el-form-item>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header>价格、库存与发布</template>
          <el-row :gutter="16">
            <el-col :xs="24" :sm="12" :md="8">
              <el-form-item label="币种">
                <el-select v-model="form.currency" style="width: 100%">
                  <el-option label="SGD" value="SGD" />
                  <el-option label="USD" value="USD" />
                  <el-option label="CNY" value="CNY" />
                  <el-option label="EUR" value="EUR" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12" :md="8">
              <el-form-item label="价格" prop="price">
                <el-input-number
                  v-model="form.price"
                  :min="0"
                  :precision="2"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12" :md="8">
              <el-form-item label="库存">
                <el-input-number
                  v-model="form.stock"
                  :min="0"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="发布状态">
            <el-switch
              v-model="form.published"
              active-text="已发布"
              inactive-text="草稿"
            />
          </el-form-item>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header>主媒体</template>
          <el-form-item label="商品首屏媒体">
            <MediaAssetInput
              v-model="form.primaryMedia"
              :legacy-image="form.image"
              module="shop"
              entity-type="product"
            />
          </el-form-item>
          <el-form-item label="详情图库">
            <ImageUpload
              v-model="form.gallery"
              module="shop"
              mode="multiple"
              :limit="10"
            />
          </el-form-item>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header>溯源与产地</template>
          <el-row :gutter="16">
            <el-col :xs="24" :sm="12">
              <el-form-item label="产地位置">
                <el-input v-model="form.originTrace.location" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="关联城市">
                <el-select
                  v-model="form.originTrace.citySlug"
                  filterable
                  clearable
                  style="width: 100%"
                  @change="handleOriginCityChange"
                >
                  <el-option
                    v-for="city in cityOptions"
                    :key="city.slug"
                    :label="`${city.name} (${city.slug})`"
                    :value="city.slug"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="产地城市名">
                <el-input v-model="form.originTrace.cityName" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="地图区划代码">
                <el-input-number
                  v-model="form.originTrace.mapAdcode"
                  :min="0"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="原料来源">
            <el-input
              v-model="form.originTrace.materialSource"
              type="textarea"
              :rows="3"
            />
          </el-form-item>
          <el-form-item label="工艺传统">
            <el-input
              v-model="form.originTrace.craftTradition"
              type="textarea"
              :rows="3"
            />
          </el-form-item>
          <el-form-item label="制作过程">
            <el-input
              v-model="form.originTrace.process"
              type="textarea"
              :rows="3"
            />
          </el-form-item>
        </el-card>

        <EditorWorkspace
          v-model="activeWorkspace"
          eyebrow="商品内容"
          title="商品内容工作台"
          description="主图、价格、库存和溯源单独维护，真正给前台展示的故事和细节集中在这里编辑。"
          :active-label="activeWorkspaceLabel"
          :tabs="workspaceTabs"
        >
          <div v-if="activeWorkspace === 'story'" class="workspace-panel">
            <div class="panel-title">商品故事</div>
            <el-form-item label="故事正文">
              <ContentMarkdownEditor v-model="form.story" :rows="8" />
            </el-form-item>
          </div>

          <div v-else class="workspace-panel">
            <div class="panel-title">商品细节</div>
            <el-form-item label="材质">
              <ContentInput v-model="form.material" />
            </el-form-item>
            <el-form-item label="尺寸">
              <ContentInput v-model="form.dimensions" />
            </el-form-item>
            <el-form-item label="产地说明">
              <ContentInput v-model="form.origin" />
            </el-form-item>
            <el-form-item label="保养说明">
              <ContentMarkdownEditor v-model="form.care" :rows="6" />
            </el-form-item>
          </div>
        </EditorWorkspace>
      </el-form>

      <FrontendPagePreview type="product" :model="form" :meta="previewMeta" />
    </div>

    <FrontendPreviewDrawer
      v-model="mobilePreviewVisible"
      type="product"
      :model="form"
      :meta="previewMeta"
    />
  </div>
</template>

<style scoped>
@import "@/assets/editor-common.css";
</style>
