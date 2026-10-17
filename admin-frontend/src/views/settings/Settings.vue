<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getSettings, updateSettings } from '@/api/settings'
import type { AppSettings, ShippingTemplate } from '@/types/settings'
import { ElMessage } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'

const loading = ref(false)
const saving = ref(false)

// ─── 表单数据 ────────────────────────────────────
const seoTitle = ref('')
const seoDescription = ref('')
const languages = ref<string[]>(['en'])
const defaultLocale = ref('en')
const defaultCurrency = ref('SGD')
const taxRate = ref(7.6)
const serviceCities = ref<string[]>([])
const serviceCityInput = ref('')
const enableMarkdownEditor = ref(true)
const pageTitleFontSize = ref(20)
const sectionTitleFontSize = ref(15)
const bodyFontSize = ref(14)
const hintFontSize = ref(12)

// 语言选项
const languageOptions = [
  { label: 'English', value: 'en' },
]

const currencyOptions = [
  { label: 'SGD ($) - 新加坡元', value: 'SGD' },
  { label: 'CNY (¥) - 人民币', value: 'CNY' },
  { label: 'USD ($) - 美元', value: 'USD' },
  { label: 'EUR (€) - 欧元', value: 'EUR' },
  { label: 'JPY (¥) - 日元', value: 'JPY' },
  { label: 'GBP (£) - 英镑', value: 'GBP' },
]

// ─── 运费模板 ────────────────────────────────────
const shippingTemplates = ref<ShippingTemplate[]>([])

function addShippingTemplate() {
  shippingTemplates.value.push({
    id: '',
    region: '',
    countries: [],
    rate: 0,
    currency: defaultCurrency.value,
    freeThreshold: 0,
  })
}

function removeShippingTemplate(index: number) {
  shippingTemplates.value.splice(index, 1)
}

// ─── 服务城市 ────────────────────────────────────
function addServiceCity() {
  const city = serviceCityInput.value.trim().toLowerCase()
  if (!city) return
  if (serviceCities.value.includes(city)) {
    ElMessage.warning('该城市已存在')
    return
  }
  serviceCities.value.push(city)
  serviceCityInput.value = ''
}

function removeServiceCity(city: string) {
  serviceCities.value = serviceCities.value.filter((c) => c !== city)
}

// ─── 数据加载 ────────────────────────────────────
async function fetchSettings() {
  loading.value = true
  try {
    const res = await getSettings()
    const data = res.data.data
    seoTitle.value = data.seoTitle
    seoDescription.value = data.seoDescription
    languages.value = ['en']
    defaultLocale.value = 'en'
    defaultCurrency.value = data.defaultCurrency || 'SGD'
    taxRate.value = data.taxRate ?? 7.6
    shippingTemplates.value = JSON.parse(JSON.stringify(data.shippingTemplates || []))
    serviceCities.value = data.serviceCities || []
    enableMarkdownEditor.value = data.enableMarkdownEditor ?? true
    pageTitleFontSize.value = data.pageTitleFontSize ?? 20
    sectionTitleFontSize.value = data.sectionTitleFontSize ?? 15
    bodyFontSize.value = data.bodyFontSize ?? 14
    hintFontSize.value = data.hintFontSize ?? 12
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '获取系统设置失败')
  } finally {
    loading.value = false
  }
}

// ─── 保存 ─────────────────────────────────────────
async function handleSave() {
  // 手动校验必填项
  if (!seoTitle.value.trim()) {
    ElMessage.warning('请输入 SEO 标题')
    return
  }
  if (taxRate.value < 0) {
    ElMessage.warning('税率不能为负数')
    return
  }
  if (pageTitleFontSize.value < 10 || pageTitleFontSize.value > 72) {
    ElMessage.warning('页面标题字号需在 10-72 之间')
    return
  }

  saving.value = true
  try {
    // 为运费模板中没有 ID 的项生成临时 ID
    const templates = shippingTemplates.value.map((t) => ({
      ...t,
      id: t.id || `ship-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }))

    const data: Partial<AppSettings> = {
      seoTitle: seoTitle.value,
      seoDescription: seoDescription.value,
      languages: languages.value,
      defaultLocale: defaultLocale.value,
      defaultCurrency: defaultCurrency.value,
      taxRate: taxRate.value,
      shippingTemplates: templates,
      serviceCities: serviceCities.value,
      enableMarkdownEditor: enableMarkdownEditor.value,
      pageTitleFontSize: pageTitleFontSize.value,
      sectionTitleFontSize: sectionTitleFontSize.value,
      bodyFontSize: bodyFontSize.value,
      hintFontSize: hintFontSize.value,
    }
    await updateSettings(data)
    ElMessage.success('系统设置已保存')
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '保存设置失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchSettings()
})
</script>

<template>
  <div class="settings-page" v-loading="loading">
    <div class="page-header">
      <div class="page-heading-copy">
        <h2>系统设置</h2>
        <span class="page-desc">配置网站 SEO、语言、币种、税率、运费模板和服务城市</span>
      </div>
    </div>

    <el-form label-width="140px" label-position="left">
      <!-- SEO 设置 -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <span class="section-title">🌐 SEO 设置</span>
        </template>
        <el-form-item label="SEO 标题">
          <el-input v-model="seoTitle" placeholder="网站首页标题（用于搜索引擎展示）" />
        </el-form-item>
        <el-form-item label="SEO 描述">
          <el-input
            v-model="seoDescription"
            type="textarea"
            :rows="3"
            placeholder="网站描述（用于搜索引擎结果摘要）"
          />
        </el-form-item>
      </el-card>

      <el-card shadow="never" class="section-card">
        <template #header>
          <span class="section-title">UI 与 Markdown</span>
        </template>
        <el-form-item label="启用 Markdown 编辑器">
          <el-switch v-model="enableMarkdownEditor" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="页面标题字号(px)">
              <el-input-number v-model="pageTitleFontSize" :min="16" :max="36" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="区块标题字号(px)">
              <el-input-number v-model="sectionTitleFontSize" :min="12" :max="24" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="正文字号(px)">
              <el-input-number v-model="bodyFontSize" :min="12" :max="20" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="提示字号(px)">
              <el-input-number v-model="hintFontSize" :min="10" :max="18" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>

      <!-- 语言设置 -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <span class="section-title">🌍 语种设置</span>
        </template>
        <el-form-item label="支持语种">
          <el-checkbox-group v-model="languages">
            <el-checkbox
              v-for="lang in languageOptions"
              :key="lang.value"
              :label="lang.value"
              :value="lang.value"
            >
              {{ lang.label }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="默认语言">
          <el-select v-model="defaultLocale" style="width: 200px">
            <el-option
              v-for="lang in languageOptions.filter(l => languages.includes(l.value))"
              :key="lang.value"
              :label="lang.label"
              :value="lang.value"
            />
          </el-select>
          <span class="form-hint">从已勾选的支持语种中选择</span>
        </el-form-item>
      </el-card>

      <!-- 币种与税率 -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <span class="section-title">💰 币种与税率</span>
        </template>
        <el-form-item label="默认币种">
          <el-select v-model="defaultCurrency" style="width: 200px">
            <el-option
              v-for="cur in currencyOptions"
              :key="cur.value"
              :label="cur.label"
              :value="cur.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="税率 (%)">
          <el-input-number
            v-model="taxRate"
            :min="0"
            :max="30"
            :precision="2"
            :step="0.1"
            style="width: 200px"
          />
          <span class="form-hint">商品售价将按此税率计算含税价格</span>
        </el-form-item>
      </el-card>

      <!-- 运费模板 -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="card-header-row">
            <span class="section-title">📦 运费模板</span>
            <el-button type="primary" size="small" :icon="Plus" @click="addShippingTemplate">
              添加模板
            </el-button>
          </div>
        </template>

        <el-empty v-if="shippingTemplates.length === 0" description="暂无运费模板" :image-size="60" />

        <div v-for="(tpl, idx) in shippingTemplates" :key="idx" class="shipping-tpl-card">
          <div class="tpl-header">
            <span class="tpl-index">模板 {{ idx + 1 }}</span>
            <el-button
              type="danger"
              size="small"
              :icon="Delete"
              link
              @click="removeShippingTemplate(idx)"
            >
              删除
            </el-button>
          </div>
          <el-row :gutter="16">
            <el-col :xs="24" :sm="8">
              <el-form-item label="区域名称">
                <el-input v-model="tpl.region" placeholder="如：Southeast Asia" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="8">
              <el-form-item label="运费金额">
                <el-input-number v-model="tpl.rate" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="8">
              <el-form-item label="包邮门槛">
                <el-input-number
                  v-model="tpl.freeThreshold"
                  :min="0"
                  :precision="2"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="适用国家">
            <el-select
              v-model="tpl.countries"
              multiple
              filterable
              allow-create
              placeholder="输入或选择国家"
              style="width: 100%"
            >
              <el-option label="Singapore" value="Singapore" />
              <el-option label="Malaysia" value="Malaysia" />
              <el-option label="Thailand" value="Thailand" />
              <el-option label="Vietnam" value="Vietnam" />
              <el-option label="Indonesia" value="Indonesia" />
              <el-option label="Philippines" value="Philippines" />
              <el-option label="Japan" value="Japan" />
              <el-option label="South Korea" value="South Korea" />
              <el-option label="United States" value="United States" />
              <el-option label="Canada" value="Canada" />
              <el-option label="United Kingdom" value="United Kingdom" />
              <el-option label="Germany" value="Germany" />
              <el-option label="France" value="France" />
              <el-option label="Australia" value="Australia" />
              <el-option label="New Zealand" value="New Zealand" />
            </el-select>
          </el-form-item>
        </div>
      </el-card>

      <!-- 服务城市 -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <span class="section-title">🏙️ 服务城市</span>
        </template>
        <el-form-item label="城市 Slug 列表">
          <div class="city-input-row">
            <el-input
              v-model="serviceCityInput"
              placeholder="输入城市 slug（如 guangzhou）"
              style="width: 280px"
              @keyup.enter="addServiceCity"
            />
            <el-button type="primary" @click="addServiceCity">添加</el-button>
          </div>
        </el-form-item>
        <el-form-item label="已添加城市">
          <div v-if="serviceCities.length === 0" class="empty-hint">暂无城市</div>
          <div v-else class="city-tags">
            <el-tag
              v-for="city in serviceCities"
              :key="city"
              closable
              size="large"
              @close="removeServiceCity(city)"
            >
              {{ city }}
            </el-tag>
          </div>
        </el-form-item>
      </el-card>

      <!-- 保存按钮 -->
      <div class="save-bar">
        <el-button type="primary" size="large" :loading="saving" @click="handleSave">
          保存设置
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 960px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0 0 4px 0;
  font-size: 20px;
  color: var(--lt-text-primary, #303133);
}

.page-desc {
  font-size: 13px;
  color: var(--lt-text-secondary, #909399);
}

.section-card {
  margin-bottom: 16px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-hint {
  margin-left: 10px;
  font-size: 12px;
  color: var(--lt-text-secondary, #909399);
}

.shipping-tpl-card {
  background: var(--lt-bg-card, #fafafa);
  border: 1px solid var(--lt-border-color, #ebeef5);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.tpl-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tpl-index {
  font-size: 14px;
  font-weight: 600;
  color: var(--lt-text-regular, #606266);
}

.city-input-row {
  display: flex;
  gap: 8px;
}

.city-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.empty-hint {
  color: var(--lt-text-placeholder, #c0c4cc);
  font-size: 13px;
}

.save-bar {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: center;
  padding: 16px var(--admin-shell-gutter);
  margin: 24px 0 0;
  background: var(--lt-bg-page, #f0f2f5);
  border-top: 1px solid var(--lt-border-light, #f0f0f0);
  z-index: 10;
}
</style>
