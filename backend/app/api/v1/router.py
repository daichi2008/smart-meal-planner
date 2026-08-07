from fastapi import APIRouter

from app.api.v1 import auth, fridge, recipes, subscription, users

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(fridge.router)
api_router.include_router(recipes.router)
api_router.include_router(subscription.router)
