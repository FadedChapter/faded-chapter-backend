/**
 * Order Service
 * Business logic for order management
 * Phase 3F.6: Order Management
 */

import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { OrderEntity, OrderStatus, PaymentStatus, FulfillmentStatus } from '../entities/order.entity';
import { AppDataSource } from '../../database/data-source';

export interface GetOrdersFilter {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  limit?: number;
  offset?: number;
  sortBy?: 'date' | 'total' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<OrderStatus, number>;
  recentOrders: OrderEntity[];
}

export class OrderService {
  private orderRepository: Repository<OrderEntity>;

  constructor() {
    this.orderRepository = AppDataSource.getRepository(OrderEntity);
  }

  /**
   * Get all orders for a user
   */
  async getUserOrders(userId: string, filter: GetOrdersFilter = {}): Promise<{
    orders: OrderEntity[];
    total: number;
  }> {
    const {
      status,
      paymentStatus,
      fulfillmentStatus,
      limit = 20,
      offset = 0,
      sortBy = 'date',
      sortOrder = 'desc',
    } = filter;

    let query = this.orderRepository.createQueryBuilder('order')
      .where('order.userId = :userId', { userId });

    // Apply filters
    if (status) {
      query = query.andWhere('order.status = :status', { status });
    }
    if (paymentStatus) {
      query = query.andWhere('order.paymentStatus = :paymentStatus', { paymentStatus });
    }
    if (fulfillmentStatus) {
      query = query.andWhere('order.fulfillmentStatus = :fulfillmentStatus', { fulfillmentStatus });
    }

    // Apply sorting
    switch (sortBy) {
      case 'total':
        query = query.orderBy('order.total', sortOrder.toUpperCase() as 'ASC' | 'DESC');
        break;
      case 'status':
        query = query.orderBy('order.status', sortOrder.toUpperCase() as 'ASC' | 'DESC');
        break;
      case 'date':
      default:
        query = query.orderBy('order.createdAt', sortOrder.toUpperCase() as 'ASC' | 'DESC');
    }

    // Get total count
    const total = await query.getCount();

    // Apply pagination
    const orders = await query
      .skip(offset)
      .take(limit)
      .getMany();

    return { orders, total };
  }

  /**
   * Get a single order by ID
   */
  async getOrderById(userId: string, orderId: string): Promise<OrderEntity | null> {
    return this.orderRepository.findOne({
      where: {
        id: orderId,
        userId,
      },
    });
  }

  /**
   * Get order by Shopify ID
   */
  async getOrderByShopifyId(shopifyOrderId: string): Promise<OrderEntity | null> {
    return this.orderRepository.findOne({
      where: {
        shopifyOrderId,
      },
    });
  }

  /**
   * Create or update order from Shopify data
   * Called during sync process
   */
  async syncOrder(
    userId: string,
    shopifyData: any
  ): Promise<OrderEntity> {
    const shopifyOrderId = shopifyData.id.toString();

    // Check if order already exists
    let order = await this.getOrderByShopifyId(shopifyOrderId);

    const orderData = {
      userId,
      shopifyOrderId,
      orderNumber: shopifyData.order_number.toString(),
      status: this.mapShopifyStatus(shopifyData.financial_status) as OrderStatus,
      paymentStatus: this.mapPaymentStatus(shopifyData.financial_status) as PaymentStatus,
      fulfillmentStatus: this.mapFulfillmentStatus(shopifyData.fulfillment_status) as FulfillmentStatus,
      lineItems: shopifyData.line_items.map((item: any) => ({
        id: item.id.toString(),
        title: item.title,
        quantity: item.quantity,
        price: parseFloat(item.price),
        total: parseFloat(item.price) * item.quantity,
        sku: item.sku,
        image_url: item.image?.src,
      })),
      subtotal: parseFloat(shopifyData.subtotal_price || 0),
      tax: parseFloat(shopifyData.total_tax || 0),
      shipping: parseFloat(shopifyData.total_shipping || 0),
      discount: parseFloat(shopifyData.total_discounts || 0),
      total: parseFloat(shopifyData.total_price || 0),
      currency: shopifyData.currency,
      shippingAddress: shopifyData.shipping_address ? {
        firstName: shopifyData.shipping_address.first_name,
        lastName: shopifyData.shipping_address.last_name,
        address1: shopifyData.shipping_address.address1,
        address2: shopifyData.shipping_address.address2,
        city: shopifyData.shipping_address.city,
        state: shopifyData.shipping_address.province,
        zip: shopifyData.shipping_address.zip,
        country: shopifyData.shipping_address.country,
      } : undefined,
      billingAddress: shopifyData.billing_address ? {
        firstName: shopifyData.billing_address.first_name,
        lastName: shopifyData.billing_address.last_name,
        address1: shopifyData.billing_address.address1,
        address2: shopifyData.billing_address.address2,
        city: shopifyData.billing_address.city,
        state: shopifyData.billing_address.province,
        zip: shopifyData.billing_address.zip,
        country: shopifyData.billing_address.country,
      } : undefined,
      email: shopifyData.email,
      phone: shopifyData.phone,
      processedAt: shopifyData.processed_at ? new Date(shopifyData.processed_at) : undefined,
      metadata: shopifyData,
      syncedAt: new Date(),
    };

    if (order) {
      // Update existing order
      Object.assign(order, orderData);
      return this.orderRepository.save(order);
    } else {
      // Create new order
      order = this.orderRepository.create({
        id: randomUUID(),
        ...orderData,
      });
      return this.orderRepository.save(order);
    }
  }

  /**
   * Get order statistics for a user
   */
  async getOrderStats(userId: string): Promise<OrderStats> {
    const orders = await this.orderRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total.toString()), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Count orders by status
    const ordersByStatus: Record<OrderStatus, number> = {
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      refunded: 0,
    };

    orders.forEach(order => {
      ordersByStatus[order.status]++;
    });

    return {
      totalOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      ordersByStatus,
      recentOrders: orders.slice(0, 5),
    };
  }

  /**
   * Get mock Shopify orders for testing
   * This is what real Shopify API would return
   */
  static getMockShopifyOrders(userId: string): any[] {
    return [
      {
        id: 1001,
        order_number: 1001,
        email: 'demo@faded.test',
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        processed_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        financial_status: 'paid',
        fulfillment_status: 'fulfilled',
        currency: 'USD',
        subtotal_price: '99.99',
        total_tax: '7.99',
        total_shipping: '5.00',
        total_discounts: '0.00',
        total_price: '112.98',
        phone: '555-1234',
        shipping_address: {
          first_name: 'John',
          last_name: 'Doe',
          address1: '123 Main St',
          address2: 'Apt 4',
          city: 'San Francisco',
          province: 'CA',
          zip: '94105',
          country: 'United States',
        },
        billing_address: {
          first_name: 'John',
          last_name: 'Doe',
          address1: '123 Main St',
          address2: 'Apt 4',
          city: 'San Francisco',
          province: 'CA',
          zip: '94105',
          country: 'United States',
        },
        line_items: [
          {
            id: 1001,
            title: 'Faded Chapter Hoodie',
            quantity: 1,
            price: '79.99',
            sku: 'HOODIE-001',
            image: { src: 'https://example.com/hoodie.jpg' },
          },
          {
            id: 1002,
            title: 'Sticker Pack',
            quantity: 1,
            price: '20.00',
            sku: 'STICKER-001',
            image: { src: 'https://example.com/sticker.jpg' },
          },
        ],
      },
      {
        id: 1002,
        order_number: 1002,
        email: 'demo@faded.test',
        created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
        updated_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        processed_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        financial_status: 'paid',
        fulfillment_status: 'partial',
        currency: 'USD',
        subtotal_price: '149.99',
        total_tax: '12.00',
        total_shipping: '10.00',
        total_discounts: '15.00',
        total_price: '156.99',
        phone: '555-1234',
        shipping_address: {
          first_name: 'John',
          last_name: 'Doe',
          address1: '123 Main St',
          address2: 'Apt 4',
          city: 'San Francisco',
          province: 'CA',
          zip: '94105',
          country: 'United States',
        },
        billing_address: {
          first_name: 'John',
          last_name: 'Doe',
          address1: '123 Main St',
          address2: 'Apt 4',
          city: 'San Francisco',
          province: 'CA',
          zip: '94105',
          country: 'United States',
        },
        line_items: [
          {
            id: 1003,
            title: 'Faded Chapter T-Shirt',
            quantity: 2,
            price: '49.99',
            sku: 'TSHIRT-001',
            image: { src: 'https://example.com/tshirt.jpg' },
          },
          {
            id: 1004,
            title: 'Hats',
            quantity: 1,
            price: '50.00',
            sku: 'HAT-001',
            image: { src: 'https://example.com/hat.jpg' },
          },
        ],
      },
      {
        id: 1003,
        order_number: 1003,
        email: 'demo@faded.test',
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        updated_at: new Date().toISOString(),
        processed_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        financial_status: 'authorized',
        fulfillment_status: 'unfulled',
        currency: 'USD',
        subtotal_price: '199.99',
        total_tax: '15.99',
        total_shipping: '0.00',
        total_discounts: '0.00',
        total_price: '215.98',
        phone: '555-1234',
        shipping_address: {
          first_name: 'John',
          last_name: 'Doe',
          address1: '123 Main St',
          address2: 'Apt 4',
          city: 'San Francisco',
          province: 'CA',
          zip: '94105',
          country: 'United States',
        },
        billing_address: {
          first_name: 'John',
          last_name: 'Doe',
          address1: '123 Main St',
          address2: 'Apt 4',
          city: 'San Francisco',
          province: 'CA',
          zip: '94105',
          country: 'United States',
        },
        line_items: [
          {
            id: 1005,
            title: 'Limited Edition Vinyl',
            quantity: 1,
            price: '199.99',
            sku: 'VINYL-LIMITED',
            image: { src: 'https://example.com/vinyl.jpg' },
          },
        ],
      },
    ];
  }

  /**
   * Map Shopify financial status to our order status
   */
  private mapShopifyStatus(financialStatus: string): string {
    switch (financialStatus) {
      case 'paid':
        return 'confirmed';
      case 'authorized':
        return 'pending';
      case 'pending':
        return 'pending';
      case 'refunded':
        return 'refunded';
      case 'voided':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  /**
   * Map Shopify financial status to payment status
   */
  private mapPaymentStatus(financialStatus: string): string {
    switch (financialStatus) {
      case 'paid':
      case 'authorized':
        return 'paid';
      case 'refunded':
        return 'refunded';
      default:
        return 'pending';
    }
  }

  /**
   * Map Shopify fulfillment status to our fulfillment status
   */
  private mapFulfillmentStatus(fulfillmentStatus: string): string {
    switch (fulfillmentStatus) {
      case 'fulfilled':
        return 'fulfilled';
      case 'partial':
        return 'partial';
      case 'restocked':
        return 'restocked';
      default:
        return 'unfulfilled';
    }
  }

  /**
   * Sync orders from Shopify (mock for now)
   * In Phase 3F.3, this will call real Shopify API
   */
  async syncOrdersFromShopify(userId: string): Promise<OrderEntity[]> {
    // Get mock orders for testing
    const mockOrders = OrderService.getMockShopifyOrders(userId);

    // Sync each order
    const syncedOrders: OrderEntity[] = [];
    for (const mockOrder of mockOrders) {
      const order = await this.syncOrder(userId, mockOrder);
      syncedOrders.push(order);
    }

    console.log(`[OrderService] 📦 Synced ${syncedOrders.length} orders from Shopify for user ${userId}`);
    return syncedOrders;
  }

  /**
   * Clean up old orders (keep last 2 years)
   */
  async cleanupOldOrders(): Promise<number> {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const result = await this.orderRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :date', { date: twoYearsAgo })
      .execute();

    return result.affected || 0;
  }
}
