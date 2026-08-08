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
│       ├── services/    # LLM client, recipe generation + cache, AdvCash SCI
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
| `ADVCASH_ACCOUNT_EMAIL` | إيميل محفظتك التجارية في Volet/AdvCash — **الفلوس بتوصل هنا** |
| `ADVCASH_SCI_NAME` | اسم الـ SCI الذي أنشأته في حسابك (For developers → SCI) |
| `ADVCASH_SCI_PASSWORD` | كلمة سر الـ SCI (للتوقيع والتحقق) |
| `ADVCASH_CURRENCY` | العملة (USD افتراضياً) |
| `ADVCASH_PLAN_PRICE_USD` | سعر خطة Pro بالدولار |
| `ADVCASH_SUBSCRIPTION_DAYS` | مدة الاشتراك بالأيام (30 افتراضياً) |
| `FRONTEND_URL` | رابط الواجهة |
| `BACKEND_URL` | الرابط العام للخادم — يستقبل إشعار الدفع من AdvCash |

## الميزات

- ✅ تسجيل دخول كامل مع JWT + تشفير Argon2
- ✅ إدارة مكونات الثلاجة (إضافة / حذف / كميات)
- ✅ توليد وصفات بالذكاء الاصطناعي حسب المكونات والهدف الحراري
- ✅ تخزين مؤقت ذكي (Redis أو في الذاكرة + طبقة قاعدة بيانات) لتقليل تكلفة الـ LLM
- ✅ حفظ الوصفات المفضلة
- ✅ اشتراكات عبر AdvCash (Volet) SCI: المستخدم يدفع ببطاقة أو محفظة، والفلوس توصل لمحفظتك مباشرة، مع تفعيل Pro تلقائيًا لـ 30 يوماً
- ✅ واجهة عربية RTL كاملة مع Tailwind CSS

## إعداد الدفع عبر AdvCash (Volet)

1. سجّل في [Volet.com](https://volet.com) (نفس AdvCash سابقاً) وأكمل توثيق الحساب.
2. من **For developers** (قائمة بروفايلك) → أنشئ **SCI**:
   - اسم الـ SCI، وبيانات موقعك، و**كلمة سر الـ SCI**.
   - صفحة نجاح: `https://موقعك/dashboard?upgraded=1`، صفحة فشل: `https://موقعك/pricing`.
   - صفحة الحالة (status): `https://الخادم/api/v1/subscription/status` (تُرسل بالـ POST من AdvCash للخادم).
3. ضع القيم في `backend/.env`:
   `ADVCASH_ACCOUNT_EMAIL` (إيميل المحفظة — **الفلوس توصل هنا**)، `ADVCASH_SCI_NAME`، `ADVCASH_SCI_PASSWORD`.
4. انتظر موافقة AdvCash على تفعيل الـ SCI (عادة ساعات).
5. أعد تشغيل الخادم. عند الدفع، يظهر تحويل جديد في محفظتك ويُفعَّل Pro تلقائياً.

> ملاحظة: الاشتراك ليس تلقائي التجديد — Pro يُفعَّل لمدة `ADVCASH_SUBSCRIPTION_DAYS` يوم، وبعدها يتحول المستخدم للخطة المجانية تلقائياً.

## ملاحظات إنتاجية

- استخدم PostgreSQL + Redis في الإنتاج.
- فعّل `agentRules: false` أو خذه بعين الاعتبار في `next.config.ts` عند الحاجة.
- أضف حماية Rate limiting (مثل `slowapi`) لنقطة توليد الوصفات.
- استبدل SQLite بترحيلات Alembic قبل الإنتاج.
