/**
 * Shipping Domain DTOs
 * Data Transfer Objects for shipping methods, rates, and calculations
 *
 * Phase 8: Shipping Integration
 */

/**
 * Shipping Method DTOs
 */
export class CreateShippingMethodDto {
  name: string;
  description?: string;
  type: 'ground' | 'express' | 'overnight' | 'international' | 'local';
  base_cost: number;
  est_days_min: number;
  est_days_max: number;
  metadata?: Record<string, any>; // carrier, service_code, etc.
}

export class UpdateShippingMethodDto {
  name?: string;
  description?: string;
  type?: 'ground' | 'express' | 'overnight' | 'international' | 'local';
  base_cost?: number;
  est_days_min?: number;
  est_days_max?: number;
  active?: boolean;
  metadata?: Record<string, any>;
}

export class ShippingMethodResponseDto {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  type: string;
  base_cost: number;
  est_days_min: number;
  est_days_max: number;
  active: boolean;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Shipping Rate DTOs
 */
export class ShippingRateInputDto {
  method_id: string;
  weight_min: number;
  weight_max: number;
  zone_code: string;
  base_rate: number;
  rate_per_unit?: number;
}

export class ImportShippingRatesDto {
  method_id: string;
  rates: ShippingRateInputDto[];
}

export class UpdateShippingRateDto {
  weight_min?: number;
  weight_max?: number;
  zone_code?: string;
  base_rate?: number;
  rate_per_unit?: number;
  active?: boolean;
}

export class ShippingRateResponseDto {
  id: string;
  store_id: string;
  method_id: string;
  weight_min: number;
  weight_max: number;
  zone_code: string;
  base_rate: number;
  rate_per_unit: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Shipping Calculation DTOs
 */
export class CalculateShippingDto {
  method_id: string;
  weight: number; // Total weight in lbs/kg
  destination: string; // Zone code or zip code
  quantity?: number; // Optional quantity for reference
}

export class ShippingCalculationResponseDto {
  method: ShippingMethodResponseDto;
  base_rate: number;
  weight_rate: number;
  shipping_cost: number;
  estimated_days_min: number;
  estimated_days_max: number;
  zone: string;
}

/**
 * Zone Validation DTOs
 */
export class ValidateZoneDto {
  destination: string; // Zone code or zip code
}

export class ZoneValidationResponseDto {
  valid: boolean;
  zone: string;
  message?: string;
}

/**
 * Carrier Rate DTOs
 */
export class CarrierShipmentDto {
  carrier: 'fedex' | 'ups' | 'usps';
  weight: number;
  zone: string;
  destination: string;
}

export class CarrierRateResponseDto {
  carrier: string;
  rates: {
    service: string;
    cost: number;
    estimated_days_min: number;
    estimated_days_max: number;
  }[];
  error?: string;
}
