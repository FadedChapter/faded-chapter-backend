/**
 * Promotions & Discounts Controllers
 * HTTP request handlers for promotions domain
 *
 * Phase 7: Promotions & Discounts Domain
 */

import { Request, Response } from 'express';
import { PromoCodeService, DiscountService } from '../services/promo.service';
import { PromoCodeRepository, DiscountApplicationRepository } from '../repositories/promo.repositories';
import {
  CreatePromoCodeDto,
  UpdatePromoCodeDto,
  ValidatePromoCodeDto,
  ApplyDiscountDto,
} from '../dtos/promo.dto';

/**
 * Promo Code Controller
 */
export class PromoCodeController {
  constructor(
    private promoService: PromoCodeService,
    private discountService: DiscountService
  ) {}

  async createPromoCode(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const dto = req.body as CreatePromoCodeDto;

      const promo = await this.promoService.createPromoCode(storeId, dto);
      res.status(201).json(promo);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getPromoCode(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, codeId } = req.params;
      const promo = await this.promoService.getPromoCode(storeId, codeId);
      res.status(200).json(promo);
    } catch (error) {
      res.status(404).json({ error: 'Promo code not found' });
    }
  }

  async updatePromoCode(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, codeId } = req.params;
      const dto = req.body as UpdatePromoCodeDto;

      const promo = await this.promoService.updatePromoCode(storeId, codeId, dto);
      res.status(200).json(promo);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async listActivePromos(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const promos = await this.promoService.getActivePromoCodes(storeId);
      res.status(200).json(promos);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getExpiringPromos(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const days = parseInt(req.query.days as string) || 7;

      const promos = await this.promoService.getExpiringPromoCodes(storeId, days);
      res.status(200).json(promos);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async validatePromoCode(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const { code, cart_subtotal } = req.body as ValidatePromoCodeDto;

      const validation = await this.promoService.validateCode(storeId, code, cart_subtotal);

      if (validation.valid && validation.promo) {
        const discount = await this.discountService.calculateDiscount(
          validation.promo,
          cart_subtotal || 0
        );

        res.status(200).json({
          valid: true,
          promo_code: validation.promo,
          estimated_discount: discount.discountAmount,
        });
      } else {
        res.status(400).json({
          valid: false,
          error: validation.error,
        });
      }
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async deactivatePromoCode(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, codeId } = req.params;
      const promo = await this.promoService.deactivatePromoCode(storeId, codeId);
      res.status(200).json(promo);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getPromoAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const storeId = req.params.storeId;
      const analytics = await this.discountService.getPromoAnalytics(storeId);
      res.status(200).json(analytics);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
}

/**
 * Discount Controller
 */
export class DiscountController {
  constructor(private discountService: DiscountService) {}

  async getCartDiscounts(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, cartId } = req.params;
      const discounts = await this.discountService.getAppliedDiscounts(storeId, cartId);
      const total = await this.discountService.getTotalDiscount(storeId, cartId);

      res.status(200).json({
        discounts,
        total_discount: total,
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getOrderDiscounts(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, orderId } = req.params;
      const discounts = await this.discountService.getAppliedDiscounts(storeId, undefined, orderId);
      const total = await this.discountService.getTotalDiscount(storeId, undefined, orderId);

      res.status(200).json({
        discounts,
        total_discount: total,
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
}
