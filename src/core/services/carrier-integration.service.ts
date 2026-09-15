/**
 * Carrier Integration Service
 * Real-time rate fetching from shipping carriers
 *
 * Phase 8: Shipping Integration
 */

import { CarrierShipmentDto, CarrierRateResponseDto } from '../dtos/shipping.dto';

/**
 * Carrier Adapter Interface
 * Extensible interface for different carrier implementations
 */
export interface ICarrierAdapter {
  /**
   * Get real-time shipping rates from the carrier
   */
  getRates(shipment: CarrierShipmentDto): Promise<CarrierRateResponseDto>;

  /**
   * Validate carrier credentials are configured
   */
  validateCredentials(): Promise<boolean>;

  /**
   * Get carrier name
   */
  getName(): string;
}

/**
 * FedEx Carrier Adapter
 * Real-time rate fetching from FedEx API
 */
export class FedExCarrierAdapter implements ICarrierAdapter {
  private apiKey: string | null = null;
  private apiSecret: string | null = null;
  private accountNumber: string | null = null;

  constructor() {
    // Initialize from environment or config
    this.apiKey = process.env['FEDEX_API_KEY'] || null;
    this.apiSecret = process.env['FEDEX_API_SECRET'] || null;
    this.accountNumber = process.env['FEDEX_ACCOUNT_NUMBER'] || null;
  }

  getName(): string {
    return 'fedex';
  }

  async validateCredentials(): Promise<boolean> {
    return !!(this.apiKey && this.apiSecret && this.accountNumber);
  }

  async getRates(shipment: CarrierShipmentDto): Promise<CarrierRateResponseDto> {
    if (!(await this.validateCredentials())) {
      return {
        carrier: 'fedex',
        rates: [],
        error: 'FedEx credentials not configured',
      };
    }

    try {
      // Mock implementation - replace with actual FedEx API call
      return {
        carrier: 'fedex',
        rates: [
          {
            service: 'FEDEX_GROUND',
            cost: this.calculateMockRate(shipment.weight, 5.99),
            estimated_days_min: 5,
            estimated_days_max: 7,
          },
          {
            service: 'FEDEX_EXPRESS_SAVER',
            cost: this.calculateMockRate(shipment.weight, 15.99),
            estimated_days_min: 2,
            estimated_days_max: 3,
          },
          {
            service: 'FEDEX_2_DAY',
            cost: this.calculateMockRate(shipment.weight, 24.99),
            estimated_days_min: 2,
            estimated_days_max: 2,
          },
          {
            service: 'FEDEX_OVERNIGHT',
            cost: this.calculateMockRate(shipment.weight, 49.99),
            estimated_days_min: 1,
            estimated_days_max: 1,
          },
        ],
      };
    } catch (error) {
      return {
        carrier: 'fedex',
        rates: [],
        error: `FedEx rate fetch failed: ${(error as Error).message}`,
      };
    }
  }

  private calculateMockRate(weight: number, baseRate: number): number {
    // Mock calculation: base_rate + $0.50 per lb
    return parseFloat((baseRate + weight * 0.5).toFixed(2));
  }
}

/**
 * UPS Carrier Adapter
 * Real-time rate fetching from UPS API
 */
export class UPSCarrierAdapter implements ICarrierAdapter {
  private apiKey: string | null = null;
  private accountNumber: string | null = null;

  constructor() {
    this.apiKey = process.env['UPS_API_KEY'] || null;
    this.accountNumber = process.env['UPS_ACCOUNT_NUMBER'] || null;
  }

  getName(): string {
    return 'ups';
  }

  async validateCredentials(): Promise<boolean> {
    return !!(this.apiKey && this.accountNumber);
  }

  async getRates(shipment: CarrierShipmentDto): Promise<CarrierRateResponseDto> {
    if (!(await this.validateCredentials())) {
      return {
        carrier: 'ups',
        rates: [],
        error: 'UPS credentials not configured',
      };
    }

    try {
      // Mock implementation - replace with actual UPS API call
      return {
        carrier: 'ups',
        rates: [
          {
            service: 'UPS_GROUND',
            cost: this.calculateMockRate(shipment.weight, 7.99),
            estimated_days_min: 5,
            estimated_days_max: 7,
          },
          {
            service: 'UPS_3_DAY_SELECT',
            cost: this.calculateMockRate(shipment.weight, 18.99),
            estimated_days_min: 3,
            estimated_days_max: 3,
          },
          {
            service: 'UPS_2ND_DAY_AIR',
            cost: this.calculateMockRate(shipment.weight, 28.99),
            estimated_days_min: 2,
            estimated_days_max: 2,
          },
          {
            service: 'UPS_NEXT_DAY_AIR',
            cost: this.calculateMockRate(shipment.weight, 54.99),
            estimated_days_min: 1,
            estimated_days_max: 1,
          },
        ],
      };
    } catch (error) {
      return {
        carrier: 'ups',
        rates: [],
        error: `UPS rate fetch failed: ${(error as Error).message}`,
      };
    }
  }

  private calculateMockRate(weight: number, baseRate: number): number {
    // Mock calculation: base_rate + $0.75 per lb
    return parseFloat((baseRate + weight * 0.75).toFixed(2));
  }
}

/**
 * USPS Carrier Adapter
 * Real-time rate fetching from USPS API
 */
export class USPSCarrierAdapter implements ICarrierAdapter {
  private apiKey: string | null = null;

  constructor() {
    this.apiKey = process.env['USPS_API_KEY'] || null;
  }

  getName(): string {
    return 'usps';
  }

  async validateCredentials(): Promise<boolean> {
    return !!this.apiKey;
  }

  async getRates(shipment: CarrierShipmentDto): Promise<CarrierRateResponseDto> {
    if (!(await this.validateCredentials())) {
      return {
        carrier: 'usps',
        rates: [],
        error: 'USPS credentials not configured',
      };
    }

    try {
      // Mock implementation - replace with actual USPS API call
      // Note: USPS is best for light packages
      if (shipment.weight > 70) {
        return {
          carrier: 'usps',
          rates: [],
          error: 'USPS does not support packages over 70 lbs',
        };
      }

      return {
        carrier: 'usps',
        rates: [
          {
            service: 'USPS_GROUND_ADVANTAGE',
            cost: this.calculateMockRate(shipment.weight, 3.99),
            estimated_days_min: 2,
            estimated_days_max: 8,
          },
          {
            service: 'USPS_PRIORITY_MAIL',
            cost: this.calculateMockRate(shipment.weight, 9.99),
            estimated_days_min: 1,
            estimated_days_max: 3,
          },
          {
            service: 'USPS_PRIORITY_MAIL_EXPRESS',
            cost: this.calculateMockRate(shipment.weight, 24.99),
            estimated_days_min: 1,
            estimated_days_max: 2,
          },
        ],
      };
    } catch (error) {
      return {
        carrier: 'usps',
        rates: [],
        error: `USPS rate fetch failed: ${(error as Error).message}`,
      };
    }
  }

  private calculateMockRate(weight: number, baseRate: number): number {
    // Mock calculation: base_rate + $0.30 per lb (USPS is cheapest for light packages)
    return parseFloat((baseRate + Math.min(weight * 0.3, 10)).toFixed(2));
  }
}

/**
 * Carrier Integration Service
 * Orchestrates real-time rate fetching from multiple carriers
 */
export class CarrierIntegrationService {
  private adapters: Map<string, ICarrierAdapter> = new Map();

  constructor() {
    // Register available carriers
    this.registerAdapter(new FedExCarrierAdapter());
    this.registerAdapter(new UPSCarrierAdapter());
    this.registerAdapter(new USPSCarrierAdapter());
  }

  registerAdapter(adapter: ICarrierAdapter): void {
    this.adapters.set(adapter.getName(), adapter);
  }

  async getRates(carrier: string, shipment: CarrierShipmentDto): Promise<CarrierRateResponseDto> {
    const adapter = this.adapters.get(carrier.toLowerCase());
    if (!adapter) {
      return {
        carrier,
        rates: [],
        error: `Carrier "${carrier}" is not supported`,
      };
    }

    return adapter.getRates(shipment);
  }

  async getMultiCarrierRates(shipment: CarrierShipmentDto): Promise<CarrierRateResponseDto[]> {
    const results: CarrierRateResponseDto[] = [];

    for (const adapter of this.adapters.values()) {
      try {
        const rates = await adapter.getRates(shipment);
        results.push(rates);
      } catch (error) {
        results.push({
          carrier: adapter.getName(),
          rates: [],
          error: `Failed to fetch rates: ${(error as Error).message}`,
        });
      }
    }

    return results;
  }

  async validateCarrier(carrier: string): Promise<boolean> {
    const adapter = this.adapters.get(carrier.toLowerCase());
    if (!adapter) return false;

    return adapter.validateCredentials();
  }

  getAvailableCarriers(): string[] {
    return Array.from(this.adapters.keys());
  }
}
