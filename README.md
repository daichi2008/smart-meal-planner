# مطبخك الذكي 🥗

مخطط وجبات ذكي: المستخدم يدخل المكونات المتوفرة في ثلاجته، وموقع يُقترح عليه وصفات صحية فورية بناءً على هدفه اليومي من السعرات الحرارية.

## البنية

```
smart-meal-planner/
├── backend/     # FastAPI (Python)
│   └── app/
│       ├── api/v1/      # Routers: auth, users, fridge, recipes, subscription
│       ├── core/        # config, database, security (JWT + Argon2)
│       ├── models/      # SQLAlchemy: User, FridgeItem, SavedRecipe, RecipeCache, Subscription
│       ├── schemas/     # Pydantic models
│       ├── services/    # LLM client, recipe generation + cache, Stripe
│       └── utils/       # Redis / in-memory cache abstraction
└── frontend/    # Next.js 16 (App Router, TypeScript, Tailwind CSS, RTL عربي)
    └── src/
        ├── app/         # الرئيسية، تسجيل الدخول، التسجيل، لوحة التحكم، الأسعار
        ├── components/  # Navbar, FridgeManager, RecipeSuggestions, UI
        ├── hooks/       # useAuth (JWT)
        └── lib/         # API client, types
```

## التشغيل

### 1. الخلفية (Backend)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows
pip install -r requirements.txt

copy .env.example .env            # ثم عدّل المفاتيح
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

- التوثيق التلقائي للـ API: http://localhost:8000/api/docs

### 2. الواجهة (Frontend)

```bash
cd frontend
npm install
copy .env.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
npm run dev
```

- الموقع: http://localhost:3000

## المتغيرات الأساسية في backend/.env

| المتغير | الوصف |
|---|---|
| `SECRET_KEY` | مفتاح توقيع JWT — غيّره للإنتاج |
| `DATABASE_URL` | SQLite افتراضياً، أو PostgreSQL: `postgresql+asyncpg://user:pass@host/db` |
| `REDIS_URL` | اختياري — يفعّل تخزيناً مؤقتاً موزّعاً (بدونها يُستخدم cache في الذاكرة) |
| `LLM_API_KEY` | مفتاح الذكاء الاصطناعي (OpenAI أو أي بوابة متوافقة) |
| `LLM_BASE_URL` | عنوان الـ API — افتراضياً OpenAI، أو أي مزود متوافق |
| `LLM_MODEL` | الموديل (افتراضياً gpt-4o-mini) |
| `STRIPE_SECRET_KEY` | مفاتيح Stripe للاشتراكات |
| `STRIPE_PRICE_PRO` | معرف سعر الاشتراك Pro في Stripe |
| `STRIPE_WEBHOOK_SECRET` | سر الـ webhook لمزامنة الاشتراكات |

## الميزات

- ✅ تسجيل دخول كامل مع JWT + تشفير Argon2
- ✅ إدارة مكونات الثلاجة (إضافة / حذف / كميات)
- ✅ توليد وصفات بالذكاء الاصطناعي حسب المكونات والهدف الحراري
- ✅ تخزين مؤقت ذكي (Redis أو في الذاكرة + طبقة قاعدة بيانات) لتقليل تكلفة الـ LLM
- ✅ حفظ الوصفات المفضلة
- ✅ اشتراكات Stripe (Free / Pro) مع webhook لمزامنة الحالة
- ✅ واجهة عربية RTL كاملة مع Tailwind CSS

## ملاحظات إنتاجية

- استخدم PostgreSQL + Redis في الإنتاج.
- فعّل `agentRules: false` أو خذه بعين الاعتبار في `next.config.ts` عند الحاجة.
- أضف حماية Rate limiting (مثل `slowapi`) لنقطة توليد الوصفات.
- استبدل SQLite بترحيلات Alembic قبل الإنتاج.
