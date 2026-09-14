export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
};

export type ApiFailure = {
  success: false;
  message: string;
  errors?: unknown;
};

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export type AuthUser = {
  id: number;
  uuid?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
};

export type LoginData = {
  token: string;
  user: AuthUser;
};

export type ApiCategory = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
};

export type ApiPresentation = {
  id: number;
  label: string;
  volumeMl?: string | null;
  concentration?: string | null;
  sku?: string | null;
  isDefault?: boolean;
  sortOrder?: number;
};

export type ApiRelatedProduct = {
  id: number;
  slug: string;
  name: string;
  imageUrl?: string | null;
  shortSummary?: string | null;
};

export type ApiProductRelation = {
  relationType?: string;
  relatedProduct: ApiRelatedProduct;
};

export type ApiContentSection = {
  id: number;
  sectionType?: string;
  title?: string;
  content?: string;
  sortOrder?: number;
};

export type ApiProductImage = {
  imageUrl: string;
  altText?: string | null;
  sortOrder?: number;
  isPrimary?: boolean;
  productPresentationId?: number | null;
};

export type ApiProduct = {
  id: number;
  slug: string;
  name: string;
  shortSummary?: string | null;
  description?: string | null;
  status?: string;
  isFeatured?: boolean;
  isNew?: boolean;
  requiresPrescription?: boolean;
  imageUrl?: string | null;
  sortOrder?: number;
  category?: ApiCategory | null;
  presentations?: ApiPresentation[];
  tags?: Array<string | { name?: string; label?: string }>;
  images?: ApiProductImage[];
  contentSections?: ApiContentSection[];
  relationsFrom?: ApiProductRelation[];
};

export type CreateOrderDetail = {
  productId: number;
  productPresentationId?: number;
  quantity: number;
};

export type CreateOrderBody = {
  status: 'draft';
  notes?: string | null;
  details: CreateOrderDetail[];
};

export type CreatedOrder = {
  id: number;
  orderNumber: string;
  status: string;
  notes?: string | null;
  details?: unknown[];
};

