/**
 * Address DTOs
 * Request and response models for address endpoints
 *
 * Phase 3: API Layer
 */

export interface AddressDTO {
  id: string;
  type: 'shipping' | 'billing';
  firstName: string;
  lastName: string;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  stateProvince: string;
  postalCode: string;
  countryCode: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  label: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAddressRequest {
  firstName: string;
  lastName: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  countryCode: string;
  type: 'shipping' | 'billing';
  label?: string;
}

export interface UpdateAddressRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  countryCode?: string;
  label?: string;
}

export interface ListAddressesResponse {
  addresses: AddressDTO[];
}

export interface SetDefaultAddressRequest {
  // No body needed, action is in the endpoint
}
