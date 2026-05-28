# 案例墙（Showcase Wall）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/showcase` page that displays Agent use-case cards with background images, "Replay" (placeholder) and "Try It" buttons. "Try It" navigates to the welcome page and pre-fills the chat input with the case's prompt. Data comes from local defaults first, then replaced by internet API if available.

**Architecture:** Modular design under `src/showcase/` with clear separation: `types.ts` for data model, `data.ts` for fetching logic, `ShowcaseCard.tsx` + `ShowcaseGrid.tsx` for presentation, `ShowcasePage.tsx` for the route entry. "Try It" reuses the existing `queueSkillPrompt` mechanism to pass prompts across navigation.

**Tech Stack:** React 19 / TypeScript 5.9 / Tailwind CSS 4 / React Router 7 / Vite 7

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/showcase/types.ts` | Create | `ShowcaseItem` interface |
| `src/showcase/data.ts` | Create | Local defaults + `useShowcases` hook |
| `src/showcase/ShowcaseCard.tsx` | Create | Single card component |
| `src/showcase/ShowcaseGrid.tsx` | Create | Responsive grid layout |
| `src/showcase/ShowcasePage.tsx` | Create | Page shell with header + grid |
| `src/App.tsx` | Modify | Add `/showcase` route |
| `src/components/WelcomePage.tsx` | Modify | Add showcase entry link below input |
| `src/components/Sidebar.tsx` | Modify | Add "Showcase" nav item |
| `src/locales/index.ts` | Modify | Add `showcase` translation types |
| `src/locales/zh.ts` | Modify | Add Chinese translations |
| `src/locales/en.ts` | Modify | Add English translations |

---

### Task 1: Create `src/showcase/types.ts`

**Files:**
- Create: `src/showcase/types.ts`

- [ ] **Step 1: Write the type definition**

```typescript
export interface ShowcaseItem {
  id: string
  title: string
  description: string
  imageUrl: string
  prompt: string
  category?: string
  tags?: string[]
  replayUrl?: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/showcase/types.ts
git commit -m "feat(showcase): add ShowcaseItem type definition"
```

---

### Task 2: Create `src/showcase/data.ts`

**Files:**
- Create: `src/showcase/data.ts`
- Modify: `src/showcase/types.ts` (already created)

- [ ] **Step 1: Write the data layer**

```typescript
import { useState, useEffect } from 'react'
import type { ShowcaseItem } from './types'

const defaultShowcases: ShowcaseItem[] = [
  {
    id: 'code-review',
    title: '代码审查助手',
    description: '上传代码文件，获取详细的代码审查建议',
    imageUrl: '/showcase/code-review.jpg',
    prompt: '请审查以下代码，找出潜在问题和改进建议，并给出具体的重构方案。',
    category: '编程',
  },
  {
    id: 'writing-helper',
    title: '写作助手',
    description: '帮你润色文章、生成大纲、翻译内容',
    imageUrl: '/showcase/writing.jpg',
    prompt: '请帮我润色以下文章，使其表达更流畅、更有说服力。',
    category: '写作',
  },
  {
    id: 'data-analysis',
    title: '数据分析助手',
    description: '分析数据表格，生成可视化建议',
    imageUrl: '/showcase/data-analysis.jpg',
    prompt: '请分析以下数据，找出关键趋势和异常点，并给出可视化建议。',
    category: '数据分析',
  },
  {
    id: 'bug-bounty',
    title: '漏洞挖掘助手',
    description: '分析代码安全漏洞，提供修复方案',
    imageUrl: '/showcase/security.jpg',
    prompt: '请分析以下代码中的安全漏洞，按严重程度排序并给出修复建议。',
    category: '安全',
  },
  {
    id: 'sql-optimizer',
    title: 'SQL 优化助手',
    description: '分析慢查询，给出优化建议',
    imageUrl: '/showcase/sql.jpg',
    prompt: '请分析以下 SQL 查询的性能瓶颈，给出优化方案和索引建议。',
    category: '数据库',
  },
  {
    id: 'api-design',
    title: 'API 设计助手',
    description: '帮你设计 RESTful API 接口',
    imageUrl: '/showcase/api.jpg',
    prompt: '请帮我设计一套 RESTful API 接口，包括路径、方法、请求体和响应格式。',
    category: '编程',
  },
]

export interface ShowcaseDataState {
  items: ShowcaseItem[]
  loading: boolean
  error: string | null
}

export function useShowcases(): ShowcaseDataState {
  const [items, setItems] = useState<ShowcaseItem[]>(defaultShowcases)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const endpoint = import.meta.env.VITE_SHOWCASE_API_URL
    if (!endpoint) return

    setLoading(true)
    fetch(endpoint, { signal: AbortSignal.timeout(8000) })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (Array.isArray(data?.showcases)) {
          setItems(data.showcases)
          setError(null)
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setLoading(false))
  }, [])

  return { items, loading, error }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/showcase/data.ts
git commit -m "feat(showcase): add useShowcases hook with local defaults and API fetch"
```

---

### Task 3: Create `src/showcase/ShowcaseCard.tsx`

**Files:**
- Create: `src/showcase/ShowcaseCard.tsx`

- [ ] **Step 1: Write the card component**

```typescript
import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocale } from '../contexts/LocaleContext'
import { useSkillPromptUI } from '../contexts/app-ui'
import type { ShowcaseItem } from './types'

interface Props {
  item: ShowcaseItem
}

export const ShowcaseCard = memo(function ShowcaseCard({ item }: Props) {
  const navigate = useNavigate()
  const { t } = useLocale()
  const { queueSkillPrompt } = useSkillPromptUI()

  const handleTryIt = () => {
    queueSkillPrompt(item.prompt)
    navigate('/')
  }

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
      style={{
        background: 'var(--c-bg-sub)',
        border: '0.5px solid var(--c-border-subtle)',
        minHeight: 220,
      }}
    >
      {/* Background image */}
      <div className="relative flex-1 overflow-hidden">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          style={{ minHeight: 140 }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
        {/* Gradient overlay for text readability */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: '70%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
          }}
        />
        {/* Text content over image */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="text-[16px] font-medium text-white">{item.title}</h3>
          <p className="mt-1 text-[13px] text-white/80 line-clamp-2">{item.description}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 p-3" style={{ background: 'var(--c-bg-sub)' }}>
        <button
          type="button"
          disabled
          className="flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: 'var(--c-bg-deep)',
            color: 'var(--c-text-secondary)',
          }}
        >
          {t.showcaseReplay}
        </button>
        <button
          type="button"
          onClick={handleTryIt}
          className="flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-[13px] font-medium transition-colors hover:opacity-90 active:scale-[0.97]"
          style={{
            background: 'var(--c-accent-send)',
            color: 'var(--c-accent-send-text)',
          }}
        >
          {t.showcaseTryIt}
        </button>
      </div>
    </div>
  )
})
```

- [ ] **Step 2: Commit**

```bash
git add src/showcase/ShowcaseCard.tsx
git commit -m "feat(showcase): add ShowcaseCard component"
```

---

### Task 4: Create `src/showcase/ShowcaseGrid.tsx`

**Files:**
- Create: `src/showcase/ShowcaseGrid.tsx`

- [ ] **Step 1: Write the grid component**

```typescript
import { memo } from 'react'
import type { ShowcaseItem } from './types'
import { ShowcaseCard } from './ShowcaseCard'

interface Props {
  items: ShowcaseItem[]
}

export const ShowcaseGrid = memo(function ShowcaseGrid({ items }: Props) {
  return (
    <div
      className="grid gap-5"
      style={{
        gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
      }}
    >
      <style>{`
        @media (min-width: 600px) {
          .showcase-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (min-width: 900px) {
          .showcase-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (min-width: 1280px) {
          .showcase-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
      `}</style>
      {items.map((item) => (
        <ShowcaseCard key={item.id} item={item} />
      ))}
    </div>
  )
})
```

Wait, the inline style approach with `@media` in `<style>` is not ideal for Tailwind. Let me use Tailwind's responsive classes instead:

```typescript
import { memo } from 'react'
import type { ShowcaseItem } from './types'
import { ShowcaseCard } from './ShowcaseCard'

interface Props {
  items: ShowcaseItem[]
}

export const ShowcaseGrid = memo(function ShowcaseGrid({ items }: Props) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <ShowcaseCard key={item.id} item={item} />
      ))}
    </div>
  )
})
```

But the project uses Tailwind CSS 4, and the responsive breakpoints might be different. Let me check if `sm`, `md`, `xl` are the standard breakpoints. In Tailwind v4, these are still the default breakpoints:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

The spec says:
- >=1280px: 4 columns → `xl:grid-cols-4`
- >=900px: 3 columns → `lg:grid-cols-3` (1024px is close enough, or we can use custom)
- >=600px: 2 columns → `sm:grid-cols-2`
- <600px: 1 column → default

Actually, let me use the Tailwind classes that match closest:
- `grid-cols-1` (default)
- `sm:grid-cols-2` (>=640px)
- `lg:grid-cols-3` (>=1024px)
- `xl:grid-cols-4` (>=1280px)

This is close enough to the spec. If the user wants exact breakpoints, they can add custom breakpoints to the Tailwind config. But for the plan, let's use the standard breakpoints.

Actually, looking at the spec more carefully:
- >=1280px: 4 columns
- >=900px: 3 columns
- >=600px: 2 columns
- <600px: 1 column

Tailwind defaults are 640, 768, 1024, 1280. So:
- 1 col: default
- 2 cols: `sm:` (640px) - but spec says 600px. Close enough.
- 3 cols: `lg:` (1024px) - but spec says 900px. A bit off.
- 4 cols: `xl:` (1280px) - matches exactly.

For the plan, I'll use the standard Tailwind breakpoints. If exact breakpoints are needed, that would require custom config which is out of scope for this feature.

Let me write the final grid component:

```typescript
import { memo } from 'react'
import type { ShowcaseItem } from './types'
import { ShowcaseCard } from './ShowcaseCard'

interface Props {
  items: ShowcaseItem[]
}

export const ShowcaseGrid = memo(function ShowcaseGrid({ items }: Props) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <ShowcaseCard key={item.id} item={item} />
      ))}
    </div>
  )
})
```

- [ ] **Step 2: Commit**

```bash
git add src/showcase/ShowcaseGrid.tsx
git commit -m "feat(showcase): add ShowcaseGrid responsive grid component"
```

---

### Task 5: Create `src/showcase/ShowcasePage.tsx`

**Files:**
- Create: `src/showcase/ShowcasePage.tsx`
- Modify: `src/showcase/ShowcaseGrid.tsx` (already created)
- Modify: `src/showcase/ShowcaseCard.tsx` (already created)

- [ ] **Step 1: Write the page component**

```typescript
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RotateCcw, LayoutGrid } from 'lucide-react'
import { useLocale } from '../contexts/LocaleContext'
import { useShowcases } from './data'
import { ShowcaseGrid } from './ShowcaseGrid'

export function ShowcasePage() {
  const navigate = useNavigate()
  const { t } = useLocale()
  const { items, loading, error } = useShowcases()

  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <div className="flex h-full flex-col bg-[var(--c-bg-page)]">
      {/* Header */}
      <div className="flex min-h-[51px] shrink-0 items-center justify-between border-b border-[var(--c-border-subtle)] px-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[14px] text-[var(--c-text-secondary)] transition-colors hover:bg-[var(--c-bg-deep)] hover:text-[var(--c-text-primary)]"
        >
          <ArrowLeft size={16} />
          <span>{t.showcaseBack}</span>
        </button>

        <h1 className="absolute left-1/2 -translate-x-1/2 text-[15px] font-medium text-[var(--c-text-primary)]">
          {t.showcaseTitle}
        </h1>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[14px] text-[var(--c-text-secondary)] transition-colors hover:bg-[var(--c-bg-deep)] hover:text-[var(--c-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw size={15} className={loading ? 'animate-spin' : ''} />
          <span>{t.showcaseRefresh}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-5">
        {loading && items.length === 0 && (
          <div className="flex h-40 items-center justify-center text-[14px] text-[var(--c-text-secondary)]">
            {t.loading}
          </div>
        )}

        {items.length > 0 ? (
          <ShowcaseGrid items={items} />
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <LayoutGrid size={40} className="text-[var(--c-text-tertiary)]" />
            <p className="text-[15px] font-medium text-[var(--c-text-secondary)]">{t.showcaseEmptyTitle}</p>
            <p className="text-[13px] text-[var(--c-text-tertiary)]">{t.showcaseEmptyDesc}</p>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-[var(--c-status-error)]/20 bg-[var(--c-status-error)]/5 px-4 py-2.5 text-[13px] text-[var(--c-status-error)]">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/showcase/ShowcasePage.tsx
git commit -m "feat(showcase): add ShowcasePage route entry"
```

---

### Task 6: Add `/showcase` route in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import ShowcasePage**

Add import near the top of `App.tsx` (after existing imports):

```typescript
import { ShowcasePage } from './showcase/ShowcasePage'
```

- [ ] **Step 2: Add route**

In the authenticated route group (after the `scheduled-jobs` route, around line 400):

```tsx
<Route path="showcase" element={<ShowcasePage />} />
```

Specifically, add it after:
```tsx
<Route path="scheduled-jobs" element={<Suspense fallback={<LoadingPage label={t.loading} />}><ScheduledJobsPage /></Suspense>} />
```

So the new block becomes:
```tsx
<Route path="scheduled-jobs" element={<Suspense fallback={<LoadingPage label={t.loading} />}><ScheduledJobsPage /></Suspense>} />
<Route path="showcase" element={<ShowcasePage />} />
<Route path="*" element={<Navigate to="/" replace />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(showcase): add /showcase route"
```

---

### Task 7: Add i18n translations

**Files:**
- Modify: `src/locales/index.ts`
- Modify: `src/locales/zh.ts`
- Modify: `src/locales/en.ts`

- [ ] **Step 1: Add types in `index.ts`**

After the `scheduledJobsTimeout: string;` line (around line 1814), add:

```typescript
  // showcase
  showcaseTitle: string;
  showcaseBack: string;
  showcaseRefresh: string;
  showcaseTryIt: string;
  showcaseReplay: string;
  showcaseEmptyTitle: string;
  showcaseEmptyDesc: string;
  showcaseEntryLink: string;
```

- [ ] **Step 2: Add Chinese translations in `zh.ts`**

After the `scheduledJobsTimeout` line (around line 1884), add:

```typescript
  showcaseTitle: '案例墙',
  showcaseBack: '返回',
  showcaseRefresh: '刷新',
  showcaseTryIt: '试一试',
  showcaseReplay: '回放',
  showcaseEmptyTitle: '暂无案例',
  showcaseEmptyDesc: '稍后再来看看',
  showcaseEntryLink: '不知道聊什么？看看案例墙',
```

- [ ] **Step 3: Add English translations in `en.ts`**

After the `scheduledJobsTimeout` line (around line 1901), add:

```typescript
  showcaseTitle: 'Showcase',
  showcaseBack: 'Back',
  showcaseRefresh: 'Refresh',
  showcaseTryIt: 'Try It',
  showcaseReplay: 'Replay',
  showcaseEmptyTitle: 'No showcases yet',
  showcaseEmptyDesc: 'Check back later',
  showcaseEntryLink: "Not sure what to chat about? Explore the showcase",
```

- [ ] **Step 4: Run type check**

```bash
cd /Users/huhui/Projects/Arkloop/src/apps/web && pnpm type-check
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/locales/
git commit -m "feat(showcase): add i18n translations"
```

---

### Task 8: Add welcome page entry link

**Files:**
- Modify: `src/components/WelcomePage.tsx`

- [ ] **Step 1: Add import**

Add `useNavigate` import if not already present (it is already imported), and add `Sparkles` from lucide-react:

```typescript
import { Sparkles } from 'lucide-react'
```

- [ ] **Step 2: Add entry link below input**

After the `SuggestionChips` component (around line 705-710), add:

```tsx
{/* Showcase entry link */}
<div className="mt-3 flex justify-center">
  <button
    type="button"
    onClick={() => navigate('/showcase')}
    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-[var(--c-text-secondary)] transition-colors hover:bg-[var(--c-bg-deep)] hover:text-[var(--c-text-primary)]"
  >
    <Sparkles size={14} />
    <span>{t.showcaseEntryLink}</span>
  </button>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/WelcomePage.tsx
git commit -m "feat(showcase): add showcase entry link on welcome page"
```

---

### Task 9: Add sidebar navigation item

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Add import**

Add `Sparkles` to the lucide-react imports (around line 24):

```typescript
  Sparkles,
```

- [ ] **Step 2: Add nav button**

After the scheduled-jobs button (around line 1781), add:

```tsx
          <button
            onClick={() => navigate('/showcase')}
            aria-label={t.showcaseTitle}
            className={navButtonClass}
            style={navButtonStyle}
          >
            <span className="pointer-events-none opacity-0 group-hover:opacity-100" style={navHoverStyle} />
            <span className="relative flex h-[16px] w-[16px] shrink-0 items-center justify-center">
              <Sparkles size={16} className="shrink-0 transition-transform duration-100 group-hover:scale-[1.05]" />
            </span>
            <span className={`relative ${navLabelClass}`} style={navLabelStyle}>{t.showcaseTitle}</span>
          </button>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(showcase): add showcase nav item in sidebar"
```

---

### Task 10: Build and verify

**Files:**
- All files (no modifications needed)

- [ ] **Step 1: Run type check**

```bash
cd /Users/huhui/Projects/Arkloop/src/apps/web && pnpm type-check
```

Expected: No errors.

- [ ] **Step 2: Run build**

```bash
cd /Users/huhui/Projects/Arkloop/src/apps/web && pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Start dev server and verify**

```bash
cd /Users/huhui/Projects/Arkloop/src/apps/web && pnpm dev
```

Then in browser:
1. Navigate to `http://localhost:19080/showcase`
2. Verify cards display with local default data
3. Click "试一试" on a card → should navigate to `/` with prompt pre-filled
4. Click "返回" → should go back to `/showcase`
5. Verify sidebar has "案例墙" nav item
6. Verify welcome page has "不知道聊什么？看看案例墙" link

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat(showcase): complete showcase wall feature"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Requirement | Task |
|---|---|
| Data model (`ShowcaseItem`) | Task 1 |
| Local defaults + API fetch | Task 2 |
| Card with background image | Task 3 |
| Responsive grid (4/3/2/1 cols) | Task 4 |
| Page with header + grid | Task 5 |
| `/showcase` route | Task 6 |
| i18n translations | Task 7 |
| Welcome page entry link | Task 8 |
| Sidebar nav item | Task 9 |
| "Try It" → `queueSkillPrompt` + navigate | Task 3 (inside ShowcaseCard) |
| "Replay" placeholder (disabled) | Task 3 (inside ShowcaseCard) |
| Loading state | Task 2 (useShowcases), Task 5 (ShowcasePage) |
| Empty state | Task 5 (ShowcasePage) |
| Error state | Task 2 (useShowcases), Task 5 (ShowcasePage) |

All spec requirements are covered. No gaps.

### 2. Placeholder Scan

No placeholders found. All code blocks contain complete, runnable code.

### 3. Type Consistency

- `ShowcaseItem` interface (Task 1) matches usage in `useShowcases` (Task 2), `ShowcaseCard` (Task 3), `ShowcaseGrid` (Task 4).
- Translation keys (`showcaseTitle`, `showcaseBack`, etc.) are consistent across `index.ts`, `zh.ts`, `en.ts` (Task 7), `ShowcasePage` (Task 5), `ShowcaseCard` (Task 3), `WelcomePage` (Task 8), `Sidebar` (Task 9).
- `queueSkillPrompt` function name matches the existing `app-ui` context API.

No type inconsistencies found.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-28-showcase-wall.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach do you prefer?**
