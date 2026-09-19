'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminProductsApi } from '@/lib/api';
import { Product, ProductDeliveryPincodeConfig, ProductImage, ProductVariation, VariationGroup, VariantValue, ProductCustomizationCombination, ProductDetailBanners, ProductDigitalFlipbook, FlipbookSection } from '@/types';
import Image from 'next/image';
import styles from './page.module.css';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import adminStyles from '../../admin-styles.module.css';
import { getAllCategories, Category } from '@/lib/api/categories';
import { useToast } from '@/contexts/ToastContext';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { sanitizeHtml } from '@/lib/utils/sanitizeHtml';
import { uploadCustomizationImage } from '@/lib/admin/uploadCustomizationImage';
import {
  DEFAULT_FLIPBOOK_HARDCOVER_COLOR,
  FLIPBOOK_HARDCOVER_PRESETS,
  normalizeFlipbookHardcoverColor,
} from '@/lib/flipbook/hardcoverColor';
import MediaLibraryModal from '@/components/admin/MediaLibraryModal';
import { MediaResource } from '@/lib/api/media';

type AdminProductImage = ProductImage & { isMain?: boolean };

function buildAdminImagesFromProduct(data: Product): AdminProductImage[] {
  const sorted = [...(data.images || [])].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );
  const main = data.imageUrl || '';
  const urlsInRows = new Set(sorted.map((i) => i.imageUrl));
  if (main && !urlsInRows.has(main)) {
    return [
      {
        id: 'main',
        productId: data.id,
        imageUrl: main,
        displayOrder: -1,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        isMain: true,
      },
      ...sorted,
    ];
  }
  return sorted.map((img, idx) => ({
    ...img,
    isMain: idx === 0,
  }));
}

/**
 * Admin Product Edit Page
 * Edit product details, images, variations, and reviews
 */
export default function AdminProductEditPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'images' | 'variations' | 'accordions'>('details');
  const { showToast } = useToast();

  const getErrorMessage = (err: unknown) => {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object' && 'message' in err) {
      const maybe = (err as { message?: unknown }).message;
      if (typeof maybe === 'string') return maybe;
    }
    return 'Something went wrong';
  };

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [taxPercent, setTaxPercent] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');
  const [maxQuantity, setMaxQuantity] = useState('99');
  const [categoryId, setCategoryId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isMembershipEligible, setIsMembershipEligible] = useState(false);
  const [isNationwideDelivery, setIsNationwideDelivery] = useState(false);
  const [isCustomizable, setIsCustomizable] = useState(false);
  const [photobookEditorEnabled, setPhotobookEditorEnabled] = useState(false);
  const [buyNowEnabled, setBuyNowEnabled] = useState(true);
  const [buyAgainEnabled, setBuyAgainEnabled] = useState(true);
  const [hoverNextImage, setHoverNextImage] = useState(false);
  const [polaroidUploadEnabled, setPolaroidUploadEnabled] = useState(false);
  const [stripUploadEnabled, setStripUploadEnabled] = useState(false);
  const [weight, setWeight] = useState('0.1');
  const [deliveryTimeText, setDeliveryTimeText] = useState('');
  const [deliveryPincodeConfigs, setDeliveryPincodeConfigs] = useState<ProductDeliveryPincodeConfig[]>([]);
  const [newDeliveryPincode, setNewDeliveryPincode] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);

  // Accordion states and handlers
  interface AccordionItem {
    title: string;
    htmlContent: string;
  }
  const [accordionItems, setAccordionItems] = useState<AccordionItem[]>([]);
  const [newAccordionTitle, setNewAccordionTitle] = useState('');
  const [newAccordionHtmlContent, setNewAccordionHtmlContent] = useState('');

  const [detailBanners, setDetailBanners] = useState<ProductDetailBanners>({
    images: [],
    adaptToFullImageRatio: false,
    displayMode: 'stacked',
  });
  const [digitalFlipbook, setDigitalFlipbook] = useState<ProductDigitalFlipbook>({
    enabled: false,
    sections: [],
    hardcoverColor: DEFAULT_FLIPBOOK_HARDCOVER_COLOR,
  });
  const [newFlipbookSectionTitle, setNewFlipbookSectionTitle] = useState('');
  const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
  const [uploadingFlipbookSectionId, setUploadingFlipbookSectionId] = useState<string | null>(null);

  // Cloudinary Media Library Picker State
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerMultiple, setMediaPickerMultiple] = useState(true);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<
    | { type: 'product-gallery' }
    | { type: 'detail-banner' }
    | { type: 'flipbook'; sectionId: string }
    | { type: 'variation-new'; groupId: string }
    | { type: 'variation-edit' }
    | null
  >(null);

  const handleMediaLibrarySelect = (selected: MediaResource[]) => {
    if (!selected || selected.length === 0 || !mediaPickerTarget) return;

    if (mediaPickerTarget.type === 'product-gallery') {
      (async () => {
        try {
          setSaving(true);
          for (const item of selected) {
            const imgUrl = item.url || item.secure_url || '';
            if (imgUrl) {
              await adminProductsApi.addImage(productId, imgUrl);
            }
          }
          const data = await adminProductsApi.getById(productId);
          applyProductFromResponse(data);
          showToast(`Added ${selected.length} image(s) from media library`, 'success');
        } catch (error) {
          console.error('Failed to add product images:', error);
          showToast(getErrorMessage(error), 'error');
        } finally {
          setSaving(false);
        }
      })();
    } else if (mediaPickerTarget.type === 'detail-banner') {
      setDetailBanners((prev) => ({
        ...prev,
        images: [...prev.images, ...selected.map((s) => s.url || s.secure_url || '')],
      }));
      showToast(`Added ${selected.length} banner image(s)`, 'success');
    } else if (mediaPickerTarget.type === 'flipbook') {
      const { sectionId } = mediaPickerTarget;
      setDigitalFlipbook((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId
            ? { ...s, imageUrls: [...s.imageUrls, ...selected.map((item) => item.url || item.secure_url || '')] }
            : s
        ),
      }));
      showToast(`Added ${selected.length} page image(s)`, 'success');
    } else if (mediaPickerTarget.type === 'variation-new') {
      const { groupId } = mediaPickerTarget;
      const firstUrl = selected[0]?.url || selected[0]?.secure_url || '';
      setNewValueInputs((prev) => ({
        ...prev,
        [groupId]: {
          ...(prev[groupId] || {
            name: '',
            price: '',
            compareAtPrice: '',
            stock: '100',
            sku: '',
            hexCode: '#3b82f6',
            imageUrl: '',
            label: '',
            placeholder: '',
            charLimit: '100',
            photobookWidthCm: '',
            photobookHeightCm: '',
          }),
          imageUrl: firstUrl,
        },
      }));
      showToast('Image selected from media library', 'success');
    } else if (mediaPickerTarget.type === 'variation-edit') {
      const firstUrl = selected[0]?.url || selected[0]?.secure_url || '';
      if (editingValueInput) {
        setEditingValueInput({ ...editingValueInput, imageUrl: firstUrl });
      }
      showToast('Image selected from media library', 'success');
    }
  };

  const [savingAccordions, setSavingAccordions] = useState(false);

  const handleAddAccordionItem = () => {
    if (!newAccordionTitle.trim() || !newAccordionHtmlContent.trim()) {
      showToast('Both accordion title and description content are required', 'error');
      return;
    }
    setAccordionItems([
      ...accordionItems,
      { title: newAccordionTitle.trim(), htmlContent: newAccordionHtmlContent.trim() }
    ]);
    setNewAccordionTitle('');
    setNewAccordionHtmlContent('');
  };

  const handleRemoveAccordionItem = (index: number) => {
    setAccordionItems(accordionItems.filter((_, i) => i !== index));
  };

  const handleMoveAccordionItem = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= accordionItems.length) return;
    const next = [...accordionItems];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setAccordionItems(next);
  };

  const handleUpdateAccordionItem = (index: number, field: keyof AccordionItem, value: string) => {
    setAccordionItems(
      accordionItems.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSaveAccordionItems = async () => {
    let itemsToSave = [...accordionItems];
    if (newAccordionTitle.trim() && newAccordionHtmlContent.trim()) {
      itemsToSave = [
        ...itemsToSave,
        { title: newAccordionTitle.trim(), htmlContent: newAccordionHtmlContent.trim() },
      ];
      setAccordionItems(itemsToSave);
      setNewAccordionTitle('');
      setNewAccordionHtmlContent('');
    }

    try {
      setSavingAccordions(true);
      const updated = await adminProductsApi.update(productId, {
        accordionItems: itemsToSave,
      });
      setAccordionItems(updated.accordionItems || itemsToSave);
      setProduct((prev) => (prev ? { ...prev, accordionItems: updated.accordionItems || itemsToSave } : updated));
      showToast('Folding titles saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save folding titles:', error);
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSavingAccordions(false);
    }
  };

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingBannerImage(true);
    try {
      const imageUrl = await adminProductsApi.uploadDetailAsset(productId, file);
      setDetailBanners((prev) => ({ ...prev, images: [...prev.images, imageUrl] }));
      showToast('Banner image added', 'success');
    } catch (error) {
      console.error('Failed to upload banner image:', error);
      showToast(getErrorMessage(error), 'error');
    } finally {
      setUploadingBannerImage(false);
    }
  };

  const handleRemoveBannerImage = (index: number) => {
    setDetailBanners((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleMoveBannerImage = (index: number, direction: 'up' | 'down') => {
    setDetailBanners((prev) => {
      const next = [...prev.images];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, images: next };
    });
  };

  const handleAddFlipbookSection = () => {
    const title = newFlipbookSectionTitle.trim();
    if (!title) {
      showToast('Section title is required', 'error');
      return;
    }
    setDigitalFlipbook((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        { id: `section-${Date.now()}`, title, imageUrls: [] },
      ],
    }));
    setNewFlipbookSectionTitle('');
  };

  const handleRemoveFlipbookSection = (sectionId: string) => {
    setDigitalFlipbook((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
    }));
  };

  const handleFlipbookSectionTitleChange = (sectionId: string, title: string) => {
    setDigitalFlipbook((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, title } : s)),
    }));
  };

  const handleFlipbookImageUpload = async (sectionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingFlipbookSectionId(sectionId);
    try {
      const imageUrl = await adminProductsApi.uploadDetailAsset(productId, file);
      setDigitalFlipbook((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, imageUrls: [...s.imageUrls, imageUrl] } : s
        ),
      }));
      showToast('Flipbook page added', 'success');
    } catch (error) {
      console.error('Failed to upload flipbook image:', error);
      showToast(getErrorMessage(error), 'error');
    } finally {
      setUploadingFlipbookSectionId(null);
    }
  };

  const handleRemoveFlipbookImage = (sectionId: string, imageIndex: number) => {
    setDigitalFlipbook((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? { ...s, imageUrls: s.imageUrls.filter((_, i) => i !== imageIndex) }
          : s
      ),
    }));
  };

  const handleMoveFlipbookImage = (sectionId: string, imageIndex: number, direction: 'up' | 'down') => {
    setDigitalFlipbook((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const next = [...s.imageUrls];
        const target = direction === 'up' ? imageIndex - 1 : imageIndex + 1;
        if (target < 0 || target >= next.length) return s;
        [next[imageIndex], next[target]] = [next[target], next[imageIndex]];
        return { ...s, imageUrls: next };
      }),
    }));
  };

  // Images
  const [images, setImages] = useState<AdminProductImage[]>([]);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);

  // Variations
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [newVariation, setNewVariation] = useState({ size: '', price: '', compareAtPrice: '', weight: '0.1', isAvailable: true });
  const [variationDrafts, setVariationDrafts] = useState<
    Record<string, { size: string; price: string; compareAtPrice: string; weight: string; isAvailable: boolean }>
  >({});
  const [savingVariationId, setSavingVariationId] = useState<string | null>(null);

  // Advanced Customizer Variations States
  const [customizationOptions, setCustomizationOptions] = useState<VariationGroup[]>([]);
  const [customizationCombinations, setCustomizationCombinations] = useState<ProductCustomizationCombination[]>([]);
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editingValueInput, setEditingValueInput] = useState<{
    name: string;
    price: string;
    hexCode: string;
    imageUrl: string;
    label: string;
    placeholder: string;
    charLimit: string;
    photobookWidthCm: string;
    photobookHeightCm: string;
  } | null>(null);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [newGroupType, setNewGroupType] = useState<VariationGroup['type']>('option_buttons');
  const [newValueInputs, setNewValueInputs] = useState<Record<string, {
    name: string;
    price: string;
    compareAtPrice: string;
    stock: string;
    sku: string;
    hexCode: string;
    imageUrl: string;
    label: string;
    placeholder: string;
    charLimit: string;
    photobookWidthCm: string;
    photobookHeightCm: string;
  }>>({});
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkStock, setBulkStock] = useState('');

  // Reviews are managed by customers only (not editable in admin product editor)

  useEffect(() => {
    if (!product) return;
    const next: Record<string, { size: string; price: string; compareAtPrice: string; weight: string; isAvailable: boolean }> = {};
    for (const v of variations) {
      const unit = v.price ?? product.pricePerLitre * v.priceMultiplier;
      next[v.id] = {
        size: v.size,
        price: String(v.price != null && Number.isFinite(v.price) ? v.price : unit),
        compareAtPrice:
          v.compareAtPrice !== null && v.compareAtPrice !== undefined
            ? String(v.compareAtPrice)
            : '',
        weight: String(v.weight ?? '0.1'),
        isAvailable: v.isAvailable,
      };
    }
    setVariationDrafts(next);
  }, [product, variations]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const data = await adminProductsApi.getById(productId);
        setProduct(data);
        setName(data.name);
        setDescription(data.description || '');
        setSellingPrice(data.sellingPrice !== null && data.sellingPrice !== undefined ? String(data.sellingPrice) : '');
        setCompareAtPrice(data.compareAtPrice !== null && data.compareAtPrice !== undefined ? String(data.compareAtPrice) : '');
        setTaxPercent(data.taxPercent !== null && data.taxPercent !== undefined ? String(data.taxPercent) : '');
        setQuantity(String(data.quantity ?? 0));
        setLowStockThreshold(String(data.lowStockThreshold ?? 10));
        setMaxQuantity(String(data.maxQuantity ?? 99));
        setCategoryId(data.categoryId ?? '');
        setIsActive(data.isActive);
        setIsMembershipEligible(data.isMembershipEligible || false);
        setIsNationwideDelivery(Boolean(data.isNationwideDelivery));
        setIsCustomizable(data.isCustomizable || false);
        setPhotobookEditorEnabled(Boolean(data.photobookEditorEnabled));
        setBuyNowEnabled(data.buyNowEnabled !== false);
        setBuyAgainEnabled(data.buyAgainEnabled !== false);
        setHoverNextImage(Boolean(data.hoverNextImage));
        setPolaroidUploadEnabled(Boolean(data.polaroidUploadEnabled));
        setStripUploadEnabled(Boolean(data.stripUploadEnabled));
        setWeight(data.weight !== null && data.weight !== undefined ? String(data.weight) : '0.1');
        setDeliveryTimeText((data.deliveryTimeText || '').trim());
        setDeliveryPincodeConfigs(
          Array.isArray(data.deliveryPincodeConfigs)
            ? data.deliveryPincodeConfigs
            : Array.isArray(data.deliveryPincodes)
              ? data.deliveryPincodes.map((pincode) => ({ pincode, deliveryTimeText: '' }))
              : []
        );

        setImages(buildAdminImagesFromProduct(data));

        setVariations(data.variations || []);
        setAccordionItems(data.accordionItems || []);
        setDetailBanners(data.detailBanners || { images: [], adaptToFullImageRatio: false, displayMode: 'stacked' });
        const loadedFlipbook = data.digitalFlipbook || { enabled: false, sections: [] };
        setDigitalFlipbook({
          ...loadedFlipbook,
          hardcoverColor: normalizeFlipbookHardcoverColor(loadedFlipbook.hardcoverColor),
        });
        setCustomizationOptions(
          (data.customizationOptions || []).map((group) =>
            group.type === 'uploads'
              ? {
                  ...group,
                  polaroidUploadEnabled: Boolean(group.polaroidUploadEnabled),
                  stripUploadEnabled: Boolean(group.stripUploadEnabled),
                }
              : group,
          ),
        );
        setCustomizationCombinations(data.customizationCombinations || []);
      } catch (error) {
        console.error('Failed to fetch product:', error);
        showToast(getErrorMessage(error), 'error');
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchProduct();
    }
  }, [productId, showToast]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getAllCategories();
        setCategories(data);
      } catch (error) {
        // Non-blocking
        console.warn('Failed to fetch categories:', error);
      }
    };

    fetchCategories();
  }, []);

  const handleSaveProduct = async () => {
    setSaving(true);
    try {
      if (variations.length === 0 && !isCustomizable) {
        if (!sellingPrice.trim() || !compareAtPrice.trim()) {
          showToast(
            'Set both Selling Price and Compare At Price, or add variations on the Variations tab.',
            'error'
          );
          return;
        }
      }

      if (sellingPrice.trim() && compareAtPrice.trim()) {
        const selling = parseFloat(sellingPrice);
        const compare = parseFloat(compareAtPrice);
        if (Number.isFinite(selling) && Number.isFinite(compare) && selling > compare) {
          showToast('Selling Price cannot be greater than Compare At Price', 'error');
          return;
        }
      }

      const uploadsGroup = customizationOptions.find((group) => group.type === 'uploads');
      const resolvedPolaroidUploadEnabled = uploadsGroup
        ? Boolean(uploadsGroup.polaroidUploadEnabled)
        : false;
      const resolvedStripUploadEnabled = uploadsGroup
        ? Boolean(uploadsGroup.stripUploadEnabled)
        : false;

      let itemsToSave = [...accordionItems];
      if (newAccordionTitle.trim() && newAccordionHtmlContent.trim()) {
        const newItem = {
          title: newAccordionTitle.trim(),
          htmlContent: newAccordionHtmlContent.trim(),
        };
        itemsToSave = [...itemsToSave, newItem];
        setAccordionItems(itemsToSave);
        setNewAccordionTitle('');
        setNewAccordionHtmlContent('');
      }

      const updates: Partial<Product> = {
        name,
        description: sanitizeHtml(description),
        taxPercent: taxPercent ? parseFloat(taxPercent) : 0,
        quantity: quantity ? parseInt(quantity) : 0,
        lowStockThreshold: lowStockThreshold ? parseInt(lowStockThreshold) : 10,
        maxQuantity: maxQuantity ? parseInt(maxQuantity) : 99,
        categoryId: categoryId || null,
        isActive,
        isMembershipEligible,
        isNationwideDelivery,
        isCustomizable,
        photobookEditorEnabled,
        buyNowEnabled,
        buyAgainEnabled,
        hoverNextImage,
        polaroidUploadEnabled: resolvedPolaroidUploadEnabled,
        stripUploadEnabled: resolvedStripUploadEnabled,
        deliveryTimeText: deliveryTimeText.trim() || null,
        deliveryPincodeConfigs: deliveryPincodeConfigs,
        weight: parseFloat(weight || '0.1'),
        accordionItems: itemsToSave,
        customizationOptions,
        customizationCombinations,
        detailBanners,
        digitalFlipbook,
      };

      if (variations.length === 0) {
        updates.sellingPrice = parseFloat(sellingPrice) || 0;
        updates.compareAtPrice = parseFloat(compareAtPrice) || 0;
        updates.pricePerLitre = parseFloat(sellingPrice) || 0;
      }

      await adminProductsApi.update(productId, updates);
      const refreshed = await adminProductsApi.getById(productId);
      setProduct(refreshed);
      setVariations(refreshed.variations || []);
      setAccordionItems(refreshed.accordionItems || []);
      setDetailBanners(refreshed.detailBanners || { images: [], adaptToFullImageRatio: false, displayMode: 'stacked' });
      const refreshedFlipbook = refreshed.digitalFlipbook || { enabled: false, sections: [] };
      setDigitalFlipbook({
        ...refreshedFlipbook,
        hardcoverColor: normalizeFlipbookHardcoverColor(refreshedFlipbook.hardcoverColor),
      });
      setCustomizationOptions(refreshed.customizationOptions || []);
      setCustomizationCombinations(refreshed.customizationCombinations || []);
      setIsCustomizable(Boolean(refreshed.isCustomizable));
      setPhotobookEditorEnabled(Boolean(refreshed.photobookEditorEnabled));
      setBuyNowEnabled(refreshed.buyNowEnabled !== false);
      setBuyAgainEnabled(refreshed.buyAgainEnabled !== false);
      setHoverNextImage(Boolean(refreshed.hoverNextImage));
      setPolaroidUploadEnabled(Boolean(refreshed.polaroidUploadEnabled));
      setStripUploadEnabled(Boolean(refreshed.stripUploadEnabled));
      setSellingPrice(
        refreshed.sellingPrice !== null && refreshed.sellingPrice !== undefined
          ? String(refreshed.sellingPrice)
          : ''
      );
      setCompareAtPrice(
        refreshed.compareAtPrice !== null && refreshed.compareAtPrice !== undefined
          ? String(refreshed.compareAtPrice)
          : ''
      );
      showToast('Product updated successfully', 'success');
    } catch (error) {
      console.error('Failed to update product:', error);
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadsHintChange = async (
    groupId: string,
    field: 'polaroidUploadHint' | 'stripUploadHint' | 'uploadHintBoth',
    value: string,
  ) => {
    const updatedOptions = customizationOptions.map((group) =>
      group.id === groupId ? { ...group, [field]: value } : group,
    );
    setCustomizationOptions(updatedOptions);

    try {
      const updated = await adminProductsApi.update(productId, {
        customizationOptions: updatedOptions,
      });
      setCustomizationOptions(updated.customizationOptions || updatedOptions);
    } catch (error) {
      console.error('Failed to update upload hint:', error);
      showToast(getErrorMessage(error), 'error');
      const refreshed = await adminProductsApi.getById(productId);
      setCustomizationOptions(refreshed.customizationOptions || []);
    }
  };

  const handleUploadsFlagChange = async (
    groupId: string,
    field: 'polaroidUploadEnabled' | 'stripUploadEnabled',
    checked: boolean,
  ) => {
    const updatedOptions = customizationOptions.map((group) =>
      group.id === groupId ? { ...group, [field]: checked } : group,
    );
    setCustomizationOptions(updatedOptions);
    if (field === 'polaroidUploadEnabled') {
      setPolaroidUploadEnabled(checked);
    } else {
      setStripUploadEnabled(checked);
    }

    try {
      const updated = await adminProductsApi.update(productId, {
        [field]: checked,
        customizationOptions: updatedOptions,
      });
      setProduct((prev) => (prev ? { ...prev, ...updated } : updated));
      setCustomizationOptions(updated.customizationOptions || updatedOptions);
      if (field === 'polaroidUploadEnabled') {
        setPolaroidUploadEnabled(Boolean(updated.polaroidUploadEnabled));
      } else {
        setStripUploadEnabled(Boolean(updated.stripUploadEnabled));
      }
    } catch (error) {
      console.error('Failed to update upload settings:', error);
      showToast(getErrorMessage(error), 'error');
      const refreshed = await adminProductsApi.getById(productId);
      setCustomizationOptions(refreshed.customizationOptions || []);
      setPolaroidUploadEnabled(Boolean(refreshed.polaroidUploadEnabled));
      setStripUploadEnabled(Boolean(refreshed.stripUploadEnabled));
    }
  };

  const handleUploadsMaxImagesMapChange = async (
    groupId: string,
    maxImagesMap: Array<{ optionValue: string; maxImages: number }>,
  ) => {
    const updatedOptions = customizationOptions.map((group) =>
      group.id === groupId ? { ...group, maxImagesMap } : group,
    );
    setCustomizationOptions(updatedOptions);

    try {
      const updated = await adminProductsApi.update(productId, {
        customizationOptions: updatedOptions,
      });
      setCustomizationOptions(updated.customizationOptions || updatedOptions);
    } catch (error) {
      console.error('Failed to update upload max images map:', error);
      showToast(getErrorMessage(error), 'error');
      const refreshed = await adminProductsApi.getById(productId);
      setCustomizationOptions(refreshed.customizationOptions || []);
    }
  };

  const persistProductFlag = async (
    field:
      | 'isCustomizable'
      | 'photobookEditorEnabled'
      | 'buyNowEnabled'
      | 'buyAgainEnabled'
      | 'polaroidUploadEnabled'
      | 'stripUploadEnabled'
      | 'hoverNextImage',
    value: boolean,
    revert: () => void
  ) => {
    try {
      const updated = await adminProductsApi.update(productId, { [field]: value });
      setProduct((prev) => (prev ? { ...prev, ...updated } : updated));
      if (field === 'isCustomizable') {
        setIsCustomizable(Boolean(updated.isCustomizable));
      } else if (field === 'photobookEditorEnabled') {
        setPhotobookEditorEnabled(Boolean(updated.photobookEditorEnabled));
      } else if (field === 'buyNowEnabled') {
        setBuyNowEnabled(updated.buyNowEnabled !== false);
      } else if (field === 'buyAgainEnabled') {
        setBuyAgainEnabled(updated.buyAgainEnabled !== false);
      } else if (field === 'polaroidUploadEnabled') {
        setPolaroidUploadEnabled(Boolean(updated.polaroidUploadEnabled));
      } else if (field === 'hoverNextImage') {
        setHoverNextImage(Boolean(updated.hoverNextImage));
      } else {
        setStripUploadEnabled(Boolean(updated.stripUploadEnabled));
      }
    } catch (error) {
      revert();
      console.error(`Failed to update ${field}:`, error);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleAddImage = async () => {
    if (!newImageFile) return;

    try {
      await adminProductsApi.addImage(productId, newImageFile);
      const data = await adminProductsApi.getById(productId);
      setProduct(data);
      setImages(buildAdminImagesFromProduct(data));
      setNewImageFile(null);
      const fileInput = document.getElementById('imageInput') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      showToast('Image added', 'success');
    } catch (error) {
      console.error('Failed to add image:', error);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const applyProductFromResponse = (data: Product) => {
    setProduct(data);
    setImages(buildAdminImagesFromProduct(data));
  };

  const persistImageOrder = async (orderedUrls: string[]) => {
    const data = await adminProductsApi.reorderImages(productId, orderedUrls);
    applyProductFromResponse(data);
    showToast('Image order updated', 'success');
  };

  const handleMoveImage = async (index: number, delta: number) => {
    const j = index + delta;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[index], next[j]] = [next[j], next[index]];
    try {
      await persistImageOrder(next.map((i) => i.imageUrl));
    } catch (error) {
      console.error('Failed to reorder images:', error);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleDeleteImage = async (image: AdminProductImage) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      if (image.id === 'main') {
        await adminProductsApi.update(productId, { imageUrl: null });
        const rest = images.filter((i) => i.id !== 'main');
        if (rest.length > 0) {
          const data = await adminProductsApi.reorderImages(productId, rest.map((i) => i.imageUrl));
          applyProductFromResponse(data);
          showToast('Cover image removed. The next image is now the cover.', 'success');
        } else {
          const data = await adminProductsApi.getById(productId);
          applyProductFromResponse(data);
          showToast('Cover image removed', 'success');
        }
        return;
      }

      await adminProductsApi.deleteImage(productId, image.id);
      const data = await adminProductsApi.getById(productId);
      applyProductFromResponse(data);
      showToast('Image deleted', 'success');
    } catch (error) {
      console.error('Failed to delete image:', error);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleAddVariation = async () => {
    if (!newVariation.size) {
      showToast('Please enter a size', 'error');
      return;
    }
    if (!newVariation.price) {
      showToast('Please enter a price', 'error');
      return;
    }

    try {
      const priceNum = parseFloat(newVariation.price);
      let compareNum: number | null = null;
      if (newVariation.compareAtPrice.trim()) {
        const c = parseFloat(newVariation.compareAtPrice);
        if (!Number.isFinite(c) || c < 0) {
          showToast('Compare at price must be a valid positive number or empty', 'error');
          return;
        }
        compareNum = c;
      }
      if (compareNum !== null && compareNum < priceNum) {
        showToast('Compare at price must be greater than or equal to the variation price', 'error');
        return;
      }

      await adminProductsApi.addVariation(productId, {
        size: newVariation.size,
        price: priceNum,
        compareAtPrice: compareNum,
        weight: parseFloat(newVariation.weight || '0.1'),
        isAvailable: newVariation.isAvailable,
        displayOrder: variations.length,
      });
      const data = await adminProductsApi.getById(productId);
      setProduct(data);
      setVariations(data.variations || []);
      setSellingPrice(
        data.sellingPrice !== null && data.sellingPrice !== undefined ? String(data.sellingPrice) : ''
      );
      setCompareAtPrice(
        data.compareAtPrice !== null && data.compareAtPrice !== undefined ? String(data.compareAtPrice) : ''
      );
      setNewVariation({ size: '', price: '', compareAtPrice: '', weight: '0.1', isAvailable: true });
      showToast('Variation added', 'success');
    } catch (error) {
      console.error('Failed to add variation:', error);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleDeleteVariation = async (variationId: string) => {
    if (!confirm('Are you sure you want to delete this variation?')) return;

    try {
      await adminProductsApi.deleteVariation(productId, variationId);
      const data = await adminProductsApi.getById(productId);
      setProduct(data);
      setVariations(data.variations || []);
      setSellingPrice(
        data.sellingPrice !== null && data.sellingPrice !== undefined ? String(data.sellingPrice) : ''
      );
      setCompareAtPrice(
        data.compareAtPrice !== null && data.compareAtPrice !== undefined ? String(data.compareAtPrice) : ''
      );
      showToast('Variation deleted', 'success');
    } catch (error) {
      console.error('Failed to delete variation:', error);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleSaveVariation = async (variationId: string) => {
    const d = variationDrafts[variationId];
    if (!d) return;
    if (!d.size.trim()) {
      showToast('Enter a variation name', 'error');
      return;
    }
    const price = parseFloat(d.price);
    if (!Number.isFinite(price) || price < 0) {
      showToast('Enter a valid selling price for this variation', 'error');
      return;
    }
    let comparePayload: number | null = null;
    if (d.compareAtPrice.trim() !== '') {
      const c = parseFloat(d.compareAtPrice);
      if (!Number.isFinite(c) || c < 0) {
        showToast('Compare at price must be a valid number or empty', 'error');
        return;
      }
      comparePayload = c;
    }
    if (comparePayload !== null && comparePayload < price) {
      showToast('Compare at price must be greater than or equal to the variation price', 'error');
      return;
    }

    setSavingVariationId(variationId);
    try {
      await adminProductsApi.updateVariation(productId, variationId, {
        size: d.size.trim(),
        price,
        compareAtPrice: comparePayload,
        weight: parseFloat(d.weight || '0.1'),
        isAvailable: d.isAvailable,
      });
      const data = await adminProductsApi.getById(productId);
      setProduct(data);
      setVariations(data.variations || []);
      setSellingPrice(
        data.sellingPrice !== null && data.sellingPrice !== undefined ? String(data.sellingPrice) : ''
      );
      setCompareAtPrice(
        data.compareAtPrice !== null && data.compareAtPrice !== undefined ? String(data.compareAtPrice) : ''
      );
      showToast('Variation saved', 'success');
    } catch (error) {
      console.error('Failed to update variation:', error);
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSavingVariationId(null);
    }
  };

  // Customization Handlers
  const handleAddGroup = () => {
    if (!newGroupTitle.trim()) {
      showToast('Please enter a variation title (e.g. Binding, Color, Size)', 'error');
      return;
    }
    if (newGroupType === 'uploads' && customizationOptions.some((group) => group.type === 'uploads')) {
      showToast('An uploads variation group already exists.', 'error');
      return;
    }
    const groupId = 'group_' + Math.random().toString(36).substr(2, 9);
    const newGroup: VariationGroup = {
      id: groupId,
      title: newGroupTitle.trim(),
      type: newGroupType,
      values: [],
      ...(newGroupType === 'uploads'
        ? {
            polaroidUploadEnabled,
            stripUploadEnabled,
          }
        : {}),
    };
    setCustomizationOptions([...customizationOptions, newGroup]);
    setNewGroupTitle('');
    // Init value inputs for this group
    setNewValueInputs(prev => ({
      ...prev,
      [groupId]: {
        name: '',
        price: '',
        compareAtPrice: '',
        stock: '100',
        sku: '',
        hexCode: '#3b82f6',
        imageUrl: '',
        label: '',
        placeholder: '',
        charLimit: '100',
        photobookWidthCm: '',
        photobookHeightCm: '',
      }
    }));
    showToast('Variation group added!', 'success');
  };

  const handleRemoveGroup = (groupId: string) => {
    if (!confirm('Are you sure you want to remove this variation group? This will also wipe out values.')) return;

    const removedGroup = customizationOptions.find((group) => group.id === groupId);
    const updatedOptions = customizationOptions.filter((group) => group.id !== groupId);
    setCustomizationOptions(updatedOptions);

    if (removedGroup?.type !== 'uploads') return;

    setPolaroidUploadEnabled(false);
    setStripUploadEnabled(false);

    void (async () => {
      try {
        const updated = await adminProductsApi.update(productId, {
          customizationOptions: updatedOptions,
          polaroidUploadEnabled: false,
          stripUploadEnabled: false,
        });
        setProduct((prev) => (prev ? { ...prev, ...updated } : updated));
        setCustomizationOptions(updated.customizationOptions || updatedOptions);
        setPolaroidUploadEnabled(Boolean(updated.polaroidUploadEnabled));
        setStripUploadEnabled(Boolean(updated.stripUploadEnabled));
      } catch (error) {
        console.error('Failed to remove uploads variation group:', error);
        showToast(getErrorMessage(error), 'error');
        const refreshed = await adminProductsApi.getById(productId);
        setCustomizationOptions(refreshed.customizationOptions || []);
        setPolaroidUploadEnabled(Boolean(refreshed.polaroidUploadEnabled));
        setStripUploadEnabled(Boolean(refreshed.stripUploadEnabled));
      }
    })();
  };

  const handleMoveGroup = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= customizationOptions.length) return;
    const next = [...customizationOptions];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setCustomizationOptions(next);
  };

  const handleAddValue = async (groupId: string) => {
    const inputs = newValueInputs[groupId];
    if (!inputs) return;

    const group = customizationOptions.find(g => g.id === groupId);
    if (!group) return;
    if (group.type === 'uploads') return;

    // Validation
    if (group.type === 'text_input') {
      if (!inputs.label.trim()) {
        showToast('Please enter a label for personalization field', 'error');
        return;
      }
    } else {
      if (!inputs.name.trim()) {
        showToast('Please enter a variant name', 'error');
        return;
      }
    }

    const valueId = 'val_' + Math.random().toString(36).substr(2, 9);
    const newValue: VariantValue = {
      id: valueId,
      name: group.type === 'text_input' ? inputs.label.trim() : inputs.name.trim(),
      price: inputs.price ? parseFloat(inputs.price) : undefined,
      compareAtPrice: inputs.compareAtPrice ? parseFloat(inputs.compareAtPrice) : undefined,
      stock: inputs.stock ? parseInt(inputs.stock) : undefined,
      sku: inputs.sku.trim() || undefined,
      hexCode: group.type === 'colour_palette' ? inputs.hexCode : undefined,
      imageUrl: group.type === 'image_selector' ? inputs.imageUrl : undefined,
      label: group.type === 'text_input' ? inputs.label.trim() : undefined,
      placeholder: group.type === 'text_input' ? inputs.placeholder.trim() : undefined,
      charLimit: group.type === 'text_input' ? parseInt(inputs.charLimit) || 100 : undefined,
      ...(group.type === 'image_selector' && photobookEditorEnabled
        ? {
            photobookWidthCm: inputs.photobookWidthCm ? parseFloat(inputs.photobookWidthCm) : undefined,
            photobookHeightCm: inputs.photobookHeightCm ? parseFloat(inputs.photobookHeightCm) : undefined,
          }
        : {}),
      isActive: true
    };

    setCustomizationOptions(customizationOptions.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          values: [...g.values, newValue]
        };
      }
      return g;
    }));

    // Reset inputs
    setNewValueInputs(prev => ({
      ...prev,
      [groupId]: {
        name: '',
        price: '',
        compareAtPrice: '',
        stock: '100',
        sku: '',
        hexCode: '#3b82f6',
        imageUrl: '',
        label: '',
        placeholder: '',
        charLimit: '100',
        photobookWidthCm: '',
        photobookHeightCm: '',
      }
    }));
    showToast('Variant value added!', 'success');
  };

  const handleRemoveValue = (groupId: string, valueId: string) => {
    setCustomizationOptions(customizationOptions.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          values: g.values.filter(v => v.id !== valueId)
        };
      }
      return g;
    }));
  };

  const handleMoveValue = (groupId: string, index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    const group = customizationOptions.find(g => g.id === groupId);
    if (!group || nextIndex < 0 || nextIndex >= group.values.length) return;

    const nextValues = [...group.values];
    [nextValues[index], nextValues[nextIndex]] = [nextValues[nextIndex], nextValues[index]];

    setCustomizationOptions(customizationOptions.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          values: nextValues
        };
      }
      return g;
    }));
  };

  const handleValueFileChange = async (groupId: string, file: File) => {
    try {
      const imageUrl = await uploadCustomizationImage(file, productId);
      setNewValueInputs(prev => ({
        ...prev,
        [groupId]: {
          ...prev[groupId] || {
            name: '',
            price: '',
            compareAtPrice: '',
            stock: '100',
            sku: '',
            hexCode: '#3b82f6',
            imageUrl: '',
            label: '',
            placeholder: '',
            charLimit: '100',
            photobookWidthCm: '',
            photobookHeightCm: '',
          },
          imageUrl,
        }
      }));
      showToast('Image uploaded successfully!', 'success');
    } catch (err) {
      showToast('Failed to upload image file', 'error');
    }
  };

  const handleSaveValueEdit = (groupId: string, valueId: string) => {
    if (!editingValueInput) return;
    
    setCustomizationOptions(prev => prev.map(group => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        values: group.values.map(val => {
          if (val.id !== valueId) return val;
          return {
            ...val,
            name: editingValueInput.name,
            price: editingValueInput.price ? parseFloat(editingValueInput.price) : undefined,
            hexCode: editingValueInput.hexCode,
            imageUrl: editingValueInput.imageUrl,
            label: editingValueInput.label,
            placeholder: editingValueInput.placeholder,
            charLimit: editingValueInput.charLimit ? parseInt(editingValueInput.charLimit) : undefined,
            ...(group.type === 'image_selector' && photobookEditorEnabled
              ? {
                  photobookWidthCm: editingValueInput.photobookWidthCm
                    ? parseFloat(editingValueInput.photobookWidthCm)
                    : undefined,
                  photobookHeightCm: editingValueInput.photobookHeightCm
                    ? parseFloat(editingValueInput.photobookHeightCm)
                    : undefined,
                }
              : {}),
          };
        })
      };
    }));
    
    setEditingValueId(null);
    setEditingValueInput(null);
    showToast('Value updated successfully!', 'success');
  };

  const handleCombinationFileChange = async (combinationId: string, file: File) => {
    try {
      const imageUrl = await uploadCustomizationImage(file, productId);
      setCustomizationCombinations(customizationCombinations.map(c => {
        if (c.id === combinationId) {
          return {
            ...c,
            imageUrl,
          };
        }
        return c;
      }));
      showToast('Combination image uploaded successfully!', 'success');
    } catch (err) {
      showToast('Failed to upload image file', 'error');
    }
  };

  const handleAutoGenerateCombinations = () => {
    const combinableGroups = customizationOptions.filter(
      (g) => g.type !== 'text_input' && g.type !== 'uploads' && g.values.length > 0,
    );
    if (combinableGroups.length === 0) {
      showToast('Add at least one variation group (Binding, Color, Size, etc.) and values to generate combinations.', 'error');
      return;
    }

    let results: Record<string, string>[] = [{}];

    for (const group of combinableGroups) {
      const nextResults: Record<string, string>[] = [];
      for (const res of results) {
        for (const val of group.values) {
          if (val.isActive) {
            nextResults.push({
              ...res,
              [group.id]: val.id
            });
          }
        }
      }
      results = nextResults;
    }

    const generated = results.map((comb, index) => {
      const sortedGroupIds = Object.keys(comb).sort();
      const id = sortedGroupIds.map(gid => comb[gid]).join('-');
      
      const existing = customizationCombinations.find(c => c.id === id);
      if (existing) {
        return existing;
      }

      return {
        id,
        combinationKeys: comb,
        price: undefined,
        compareAtPrice: undefined,
        stock: 100,
        sku: `SKU-${id.toUpperCase()}`,
        isActive: true
      };
    });

    setCustomizationCombinations(generated);
    showToast('Product combinations generated successfully!', 'success');
  };

  const handleBulkPriceApply = () => {
    const val = parseFloat(bulkPrice);
    if (isNaN(val) || val < 0) {
      showToast('Please enter a valid price for bulk update', 'error');
      return;
    }
    setCustomizationCombinations(customizationCombinations.map(c => ({
      ...c,
      price: val
    })));
    showToast(`Applied price ₹${val} to all combinations.`, 'success');
    setBulkPrice('');
  };

  const handleBulkStockApply = () => {
    const val = parseInt(bulkStock);
    if (isNaN(val) || val < 0) {
      showToast('Please enter a valid stock number for bulk update', 'error');
      return;
    }
    setCustomizationCombinations(customizationCombinations.map(c => ({
      ...c,
      stock: val
    })));
    showToast(`Applied stock ${val} to all combinations.`, 'success');
    setBulkStock('');
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        padding: '2rem'
      }}>
        <LoadingSpinnerWithText text="Loading product..." />
      </div>
    );
  }

  if (!product) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Product not found</p>
            <button onClick={() => router.push('/admin/products')} className={styles.backButton}>
              ← Back to Products
            </button>
          </div>
        </div>
      </div>
    );
  }

  const categoryName = categories.find((cat) => cat.id === categoryId)?.name || 'Uncategorized';
  const coverImage = images[0]?.imageUrl || product.imageUrl || '';
  const displayPrice = variations.length > 0
    ? `${variations.length} price${variations.length === 1 ? '' : 's'}`
    : sellingPrice
      ? `₹${sellingPrice}`
      : 'No price';
  const stockStatus = Number(quantity || 0) <= 0
    ? 'Out of stock'
    : Number(quantity || 0) <= Number(lowStockThreshold || 0)
      ? 'Low stock'
      : 'In stock';
  const tabItems = [
    { key: 'details', label: 'Details', count: null },
    { key: 'images', label: 'Images', count: images.length },
    { key: 'variations', label: 'Variations', count: isCustomizable ? customizationOptions.length + customizationCombinations.length : variations.length },
    { key: 'accordions', label: 'Folding Titles', count: accordionItems.length },
  ] as const;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => router.back()} className={styles.backButton}>
          ← Back
        </button>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Product Studio</span>
          <h1 className={adminStyles.adminPageTitle}>{product.name}</h1>
          <p className={styles.heroDescription}>
            Edit catalog details, storefront media, pricing, availability, customizer options, and product description sections from one workspace.
          </p>
        </div>
      </div>

      <div className={styles.heroSummary}>
        <div className={styles.heroPreview}>
          <div className={styles.previewImageWrap}>
            {coverImage ? (
              <Image
                src={coverImage}
                alt={product.name}
                width={112}
                height={112}
                className={styles.previewImage}
              />
            ) : (
              <div className={styles.previewPlaceholder}>✦</div>
            )}
          </div>
          <div className={styles.previewMeta}>
            <span>{categoryName}</span>
            <strong>{displayPrice}</strong>
          </div>
        </div>

        <div className={styles.metricGrid}>
          <div className={styles.metricCard}>
            <span>Status</span>
            <strong>{isActive ? 'Live' : 'Hidden'}</strong>
          </div>
          <div className={styles.metricCard}>
            <span>Stock</span>
            <strong>{stockStatus}</strong>
          </div>
          <div className={styles.metricCard}>
            <span>Media</span>
            <strong>{images.length}</strong>
          </div>
          <div className={styles.metricCard}>
            <span>Delivery</span>
            <strong>{isNationwideDelivery ? 'Nationwide' : `${deliveryPincodeConfigs.length} PINs`}</strong>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {tabItems.map((tab) => (
          <button
            key={tab.key}
            className={activeTab === tab.key ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(tab.key)}
          >
            <span>{tab.label}</span>
            {tab.count !== null ? <strong>{tab.count}</strong> : null}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className={styles.content}>
        {/* Product Details Tab */}
        {activeTab === 'details' && (
          <div className={styles.section}>
            <h2>Product Information</h2>
            <div className={styles.formGroup}>
              <label>Product Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Description</label>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Describe your product..."
              />
            </div>
            {variations.length > 0 ? (
              <div className={styles.formGroup}>
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    background: '#eff6ff',
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Pricing:</strong> This product uses size variations. Set selling and compare-at per size on
                  the Variations tab. Product-level selling/compare-at here are cleared while variations exist. To use
                  one fixed price for the whole product, remove all variations first, then set both prices here and
                  save.
                </div>
              </div>
            ) : (
              <div className={styles.formRow}>
                <div style={{ flex: 1 }}>
                  <div className={styles.formGroup}>
                    <label>Selling Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      className={styles.input}
                      placeholder="Required"
                    />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className={styles.formGroup}>
                    <label>Compare At Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={compareAtPrice}
                      onChange={(e) => setCompareAtPrice(e.target.value)}
                      className={styles.input}
                      placeholder="Required"
                    />
                  </div>
                </div>
              </div>
            )}
            <div className={styles.formRow}>
              <div style={{ flex: 1 }}>
                <div className={styles.formGroup}>
                  <label>Tax (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(e.target.value)}
                    className={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className={styles.formGroup}>
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className={styles.formGroup}>
                  <label>Low Stock Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className={styles.formGroup}>
                  <label>Max Quantity Per Order</label>
                  <input
                    type="number"
                    min="1"
                    value={maxQuantity}
                    onChange={(e) => setMaxQuantity(e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>
            </div>
            <div className={styles.formRow}>
              <div style={{ flex: 1 }}>
                <div className={styles.formGroup}>
                  <label>Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className={styles.input}
                  >
                    <option value="">No Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className={styles.formGroup}>
                  <label>Default Product Weight (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className={styles.input}
                    placeholder="0.1"
                  />
                  <div className={styles.helpText} style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#64748b' }}>
                    Used as the shipping weight if the product has no variations.
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active (visible to customers)
              </label>
            </div>
            <div className={styles.formGroup}>
              <label>
                <input
                  type="checkbox"
                  checked={isMembershipEligible}
                  onChange={(e) => setIsMembershipEligible(e.target.checked)}
                />
                Eligible for Membership (show in membership section)
              </label>
            </div>
            <div className={styles.formGroup}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isCustomizable}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const previous = isCustomizable;
                    setIsCustomizable(checked);
                    void persistProductFlag('isCustomizable', checked, () => setIsCustomizable(previous));
                  }}
                />
                Mark as Customizable (show customizable badge)
              </label>
            </div>
            <div className={styles.formGroup}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={photobookEditorEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const previous = photobookEditorEnabled;
                    setPhotobookEditorEnabled(checked);
                    void persistProductFlag('photobookEditorEnabled', checked, () => setPhotobookEditorEnabled(previous));
                  }}
                />
                Start customizing(enables the design editor)
              </label>
            </div>
            {photobookEditorEnabled && (
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                Map photobook canvas size (cm) on each Image Selector option in the Variations tab.
              </p>
            )}
            <div className={styles.formGroup}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={buyNowEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const previous = buyNowEnabled;
                    setBuyNowEnabled(checked);
                    void persistProductFlag('buyNowEnabled', checked, () => setBuyNowEnabled(previous));
                  }}
                />
                Enable buy now button
              </label>
            </div>
            <div className={styles.formGroup}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={buyAgainEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const previous = buyAgainEnabled;
                    setBuyAgainEnabled(checked);
                    void persistProductFlag('buyAgainEnabled', checked, () => setBuyAgainEnabled(previous));
                  }}
                />
                Show buy again
              </label>
            </div>
            <div className={styles.formGroup}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hoverNextImage}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const previous = hoverNextImage;
                    setHoverNextImage(checked);
                    void persistProductFlag('hoverNextImage', checked, () => setHoverNextImage(previous));
                  }}
                />
                Next image on hover
              </label>
            </div>
            <div className={styles.formGroup}>
              <label>Estimated delivery</label>
              <input
                type="text"
                value={deliveryTimeText}
                onChange={(e) => setDeliveryTimeText(e.target.value.slice(0, 60))}
                className={styles.input}
                placeholder="e.g. 3-5 days"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Product Delivery Pincodes</label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#64748b', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={isNationwideDelivery}
                  onChange={(e) => setIsNationwideDelivery(e.target.checked)}
                />
                Eligble for nationwide Delivery
              </label>
              {deliveryPincodeConfigs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {deliveryPincodeConfigs.map((entry) => (
                    <div key={entry.pincode} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0.35rem 0.6rem',
                          borderRadius: '999px',
                          background: '#eef2ff',
                          color: '#312e81',
                          fontSize: '0.85rem',
                          minWidth: '88px',
                          justifyContent: 'center',
                        }}
                      >
                        {entry.pincode}
                      </span>
                      <input
                        type="text"
                        value={entry.deliveryTimeText || ''}
                        onChange={(e) =>
                          setDeliveryPincodeConfigs((prev) =>
                            prev.map((x) =>
                              x.pincode === entry.pincode ? { ...x, deliveryTimeText: e.target.value.slice(0, 60) } : x
                            )
                          )
                        }
                        className={styles.input}
                        placeholder="Delivery time text (e.g. 45 mins)"
                        style={{ maxWidth: '320px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setDeliveryPincodeConfigs((prev) => prev.filter((x) => x.pincode !== entry.pincode))}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#4338ca', fontSize: '1.1rem' }}
                        aria-label={`Remove pincode ${entry.pincode}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.formRow}>
                <input
                  type="text"
                  value={newDeliveryPincode}
                  onChange={(e) => setNewDeliveryPincode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                  className={styles.input}
                  placeholder="6-digit pincode"
                  style={{ maxWidth: '220px' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newDeliveryPincode.length !== 6) return;
                    if (deliveryPincodeConfigs.some((x) => x.pincode === newDeliveryPincode)) return;
                    setDeliveryPincodeConfigs((prev) => [...prev, { pincode: newDeliveryPincode, deliveryTimeText: '' }]);
                    setNewDeliveryPincode('');
                  }}
                  className={styles.addButton}
                >
                  Add
                </button>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>
                Saved pincodes always use their matching delivery time text. When nationwide delivery is enabled,
                other valid pincodes show 3-5 Days delivery. When it is disabled, other pincodes show Not deliverable.
              </p>
            </div>

            <div className={styles.formGroup} style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Detail Banner Images</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                Optional banners shown below the product details on the storefront. Add as many images as you need.
              </p>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={detailBanners.adaptToFullImageRatio}
                  onChange={(e) => setDetailBanners((prev) => ({ ...prev, adaptToFullImageRatio: e.target.checked }))}
                />
                Adapt to full image ratio
              </label>

              <div className={styles.formGroup}>
                <label>Display mode</label>
                <select
                  value={detailBanners.displayMode || 'stacked'}
                  onChange={(e) => setDetailBanners((prev) => ({
                    ...prev,
                    displayMode: e.target.value as ProductDetailBanners['displayMode'],
                  }))}
                  className={styles.input}
                  style={{ maxWidth: '280px' }}
                >
                  <option value="stacked">One by one (stacked)</option>
                  <option value="carousel">Carousel</option>
                </select>
              </div>

              {detailBanners.images.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                  {detailBanners.images.map((url, index) => (
                    <div key={`${url}-${index}`} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ width: 120, height: 72, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9', flexShrink: 0 }}>
                        <img src={url} alt={`Banner ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button type="button" className={styles.addButton} onClick={() => handleMoveBannerImage(index, 'up')} disabled={index === 0}>↑</button>
                        <button type="button" className={styles.addButton} onClick={() => handleMoveBannerImage(index, 'down')} disabled={index === detailBanners.images.length - 1}>↓</button>
                        <button type="button" onClick={() => handleRemoveBannerImage(index)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626' }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMediaPickerMultiple(true);
                    setMediaPickerTarget({ type: 'detail-banner' });
                    setMediaPickerOpen(true);
                  }}
                  className={styles.addButton}
                  style={{
                    background: '#0ea5e9',
                    borderColor: '#0ea5e9',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1.25rem',
                    fontWeight: 600,
                  }}
                >
                  <span>🖼️</span> + Add Banner from Media Library
                </button>
              </div>
            </div>

            <div className={styles.formGroup} style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Digital Flipbook</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                Create flipbook sections (e.g. 360 Wheel, Daily check-in) and add page images to each section.
              </p>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={digitalFlipbook.enabled}
                  onChange={(e) => setDigitalFlipbook((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
                Enable digital flipbook on product page
              </label>

              {digitalFlipbook.enabled && (
                <div style={{ marginBottom: '1.25rem', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: 12, background: '#fafafa' }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '0.65rem' }}>
                    Hardcover color
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <input
                      type="color"
                      value={normalizeFlipbookHardcoverColor(digitalFlipbook.hardcoverColor)}
                      onChange={(e) => setDigitalFlipbook((prev) => ({ ...prev, hardcoverColor: e.target.value.toLowerCase() }))}
                      aria-label="Pick hardcover color"
                      style={{ width: 44, height: 44, padding: 0, border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', background: 'transparent' }}
                    />
                    <input
                      type="text"
                      value={normalizeFlipbookHardcoverColor(digitalFlipbook.hardcoverColor)}
                      onChange={(e) => {
                        const next = e.target.value.trim();
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(next)) {
                          setDigitalFlipbook((prev) => ({ ...prev, hardcoverColor: next }));
                        }
                      }}
                      onBlur={(e) => setDigitalFlipbook((prev) => ({
                        ...prev,
                        hardcoverColor: normalizeFlipbookHardcoverColor(e.target.value),
                      }))}
                      className={styles.input}
                      placeholder="#5f6b3d"
                      style={{ width: 120, fontFamily: 'monospace' }}
                    />
                    <div
                      aria-hidden="true"
                      style={{
                        width: 72,
                        height: 44,
                        borderRadius: 4,
                        border: '1px solid #cbd5e1',
                        background: `linear-gradient(165deg, color-mix(in srgb, ${normalizeFlipbookHardcoverColor(digitalFlipbook.hardcoverColor)} 86%, white) 0%, ${normalizeFlipbookHardcoverColor(digitalFlipbook.hardcoverColor)} 52%, color-mix(in srgb, ${normalizeFlipbookHardcoverColor(digitalFlipbook.hardcoverColor)} 78%, black) 100%)`,
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {FLIPBOOK_HARDCOVER_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setDigitalFlipbook((prev) => ({ ...prev, hardcoverColor: preset.value }))}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.35rem 0.65rem',
                          borderRadius: 999,
                          border: normalizeFlipbookHardcoverColor(digitalFlipbook.hardcoverColor) === preset.value
                            ? '2px solid #111'
                            : '1px solid #cbd5e1',
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          color: '#334155',
                        }}
                      >
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: preset.value,
                            border: '1px solid rgba(0,0,0,0.12)',
                          }}
                        />
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.formRow} style={{ marginBottom: '1rem' }}>
                <input
                  type="text"
                  value={newFlipbookSectionTitle}
                  onChange={(e) => setNewFlipbookSectionTitle(e.target.value)}
                  className={styles.input}
                  placeholder="New section title (e.g. Daily check-in)"
                />
                <button type="button" onClick={handleAddFlipbookSection} className={styles.addButton}>
                  Add section
                </button>
              </div>

              {digitalFlipbook.sections.map((section: FlipbookSection) => (
                <div key={section.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
                  <div className={styles.formRow} style={{ marginBottom: '0.75rem' }}>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => handleFlipbookSectionTitleChange(section.id, e.target.value)}
                      className={styles.input}
                      placeholder="Section title"
                    />
                    <button type="button" onClick={() => handleRemoveFlipbookSection(section.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626' }}>
                      Remove section
                    </button>
                  </div>

                  {section.imageUrls.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      {section.imageUrls.map((url, imageIndex) => (
                        <div key={`${url}-${imageIndex}`} style={{ position: 'relative' }}>
                          <img src={url} alt={`Page ${imageIndex + 1}`} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 6 }} />
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            <button type="button" className={styles.addButton} style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => handleMoveFlipbookImage(section.id, imageIndex, 'up')} disabled={imageIndex === 0}>↑</button>
                            <button type="button" className={styles.addButton} style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => handleMoveFlipbookImage(section.id, imageIndex, 'down')} disabled={imageIndex === section.imageUrls.length - 1}>↓</button>
                            <button type="button" onClick={() => handleRemoveFlipbookImage(section.id, imageIndex)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626', fontSize: '0.75rem' }}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setMediaPickerMultiple(true);
                        setMediaPickerTarget({ type: 'flipbook', sectionId: section.id });
                        setMediaPickerOpen(true);
                      }}
                      className={styles.addButton}
                      style={{
                        background: '#0ea5e9',
                        borderColor: '#0ea5e9',
                        color: '#ffffff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontWeight: 600,
                      }}
                    >
                      <span>🖼️</span> + Add Page from Media Library
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleSaveProduct}
              disabled={saving}
              className={styles.saveButton}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* Images Tab */}
        {activeTab === 'images' && (
          <div className={styles.section}>
            <h2>Product Images</h2>
            <p className={styles.imagesHint}>
              The first image is the cover (product cards and first slide in the customer gallery). Use Up / Down to change order.
              New uploads are added without removing existing images.
            </p>
            <div className={styles.imageGrid}>
              {images.map((image, index) => (
                <div key={`${image.id}-${index}`} className={styles.imageCard}>
                  {index === 0 && (
                    <div className={`${styles.imageBadge} ${styles.imageBadgeMain}`}>Cover</div>
                  )}
                  <Image
                    src={image.imageUrl}
                    alt="Product image"
                    width={200}
                    height={200}
                    style={{ objectFit: 'cover', borderRadius: '8px' }}
                  />
                  <div className={styles.imageCardActions}>
                    <button
                      type="button"
                      className={styles.reorderButton}
                      disabled={index === 0}
                      onClick={() => handleMoveImage(index, -1)}
                      aria-label="Move image up"
                    >
                      ↑ Up
                    </button>
                    <button
                      type="button"
                      className={styles.reorderButton}
                      disabled={index === images.length - 1}
                      onClick={() => handleMoveImage(index, 1)}
                      aria-label="Move image down"
                    >
                      ↓ Down
                    </button>
                    <button type="button" onClick={() => handleDeleteImage(image)} className={styles.deleteButton}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.addSection}>
              <h3>Add Product Images</h3>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMediaPickerMultiple(true);
                    setMediaPickerTarget({ type: 'product-gallery' });
                    setMediaPickerOpen(true);
                  }}
                  className={styles.addButton}
                  style={{
                    background: '#0ea5e9',
                    borderColor: '#0ea5e9',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                  }}
                >
                  <span>🖼️</span> + Add from Media Library
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Variations Tab */}
        {activeTab === 'variations' && (
          <div className={styles.section} style={{ maxWidth: '100%', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: '#0f172a' }}>Product Customization & Variation System</h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#64748b' }}>
                  Create custom variation groups (e.g. Binding, Cover Type, Colour) and manage their combinations.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f1f5f9', padding: '0.5rem 1rem', borderRadius: '30px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Customizable Mode</span>
                <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={isCustomizable}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const previous = isCustomizable;
                      setIsCustomizable(checked);
                      void persistProductFlag('isCustomizable', checked, () => setIsCustomizable(previous));
                      if (checked && customizationOptions.length === 0) {
                        // Populate some sample groups if empty to guide the merchant
                        setCustomizationOptions([
                          {
                            id: 'group_binding',
                            title: 'Binding',
                            type: 'image_selector',
                            values: []
                          },
                          {
                            id: 'group_color',
                            title: 'Colour',
                            type: 'colour_palette',
                            values: []
                          }
                        ]);
                        setNewValueInputs({
                          'group_binding': { name: '', price: '', compareAtPrice: '', stock: '100', sku: '', hexCode: '#3b82f6', imageUrl: '', label: '', placeholder: '', charLimit: '100', photobookWidthCm: '', photobookHeightCm: '' },
                          'group_color': { name: '', price: '', compareAtPrice: '', stock: '100', sku: '', hexCode: '#3b82f6', imageUrl: '', label: '', placeholder: '', charLimit: '100', photobookWidthCm: '', photobookHeightCm: '' }
                        });
                      }
                    }}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: isCustomizable ? '#10b981' : '#cbd5e1',
                    transition: '0.3s',
                    borderRadius: '34px'
                  }}>
                    <span style={{
                      position: 'absolute',
                      content: '""',
                      height: '18px', width: '18px',
                      left: isCustomizable ? '26px' : '4px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      transition: '0.3s',
                      borderRadius: '50%',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            {!isCustomizable ? (
              /* Classical size variations list if customizer is disabled */
              <div>
                {variations.length > 0 && (
                  <div className={styles.variationsList}>
                    {variations.map((variation) => {
                      const draft = variationDrafts[variation.id];
                      return (
                        <div key={variation.id} className={styles.variationCard} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'stretch' }}>
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
                              <span style={{ fontWeight: 600, minWidth: '80px' }}>{variation.size}</span>
                              <span style={{ color: '#2563eb', fontWeight: 600 }}>₹{variation.price}</span>
                              {variation.compareAtPrice && (
                                <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '0.85rem' }}>₹{variation.compareAtPrice}</span>
                              )}
                              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>({variation.weight} kg)</span>
                              <span style={{
                                fontSize: '0.75rem',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '4px',
                                background: variation.isAvailable ? '#ecfdf5' : '#fef2f2',
                                color: variation.isAvailable ? '#059669' : '#dc2626',
                                fontWeight: 700
                              }}>
                                {variation.isAvailable ? 'Available' : 'Out of stock'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setVariationDrafts((prev) => ({
                                    ...prev,
                                    [variation.id]: {
                                      size: variation.size,
                                      price: String(variation.price),
                                      compareAtPrice: variation.compareAtPrice ? String(variation.compareAtPrice) : '',
                                      weight: String(variation.weight),
                                      isAvailable: variation.isAvailable,
                                    },
                                  }));
                                }}
                                style={{
                                  padding: '0.3rem 0.75rem',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  backgroundColor: 'white',
                                  fontSize: '0.85rem'
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteVariation(variation.id)}
                                style={{
                                  padding: '0.3rem 0.75rem',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  backgroundColor: '#ef4444',
                                  color: 'white',
                                  fontSize: '0.85rem'
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          {draft ? (
                            <div style={{
                              marginTop: '0.5rem',
                              padding: '1rem',
                              background: 'white',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.75rem'
                            }}>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <input
                                  type="text"
                                  placeholder="Size"
                                  value={draft.size}
                                  onChange={(e) =>
                                    setVariationDrafts((prev) => ({
                                      ...prev,
                                      [variation.id]: { ...prev[variation.id], size: e.target.value },
                                    }))
                                  }
                                  style={{ flex: 1, minWidth: '120px', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                />
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="Price"
                                  value={draft.price}
                                  onChange={(e) =>
                                    setVariationDrafts((prev) => ({
                                      ...prev,
                                      [variation.id]: { ...prev[variation.id], price: e.target.value },
                                    }))
                                  }
                                  style={{ width: '90px', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                />
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="Compare at"
                                  value={draft.compareAtPrice}
                                  onChange={(e) =>
                                    setVariationDrafts((prev) => ({
                                      ...prev,
                                      [variation.id]: { ...prev[variation.id], compareAtPrice: e.target.value },
                                    }))
                                  }
                                  style={{ width: '100px', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                />
                                <input
                                  type="number"
                                  step="0.001"
                                  placeholder="Weight (kg)"
                                  value={draft.weight}
                                  onChange={(e) =>
                                    setVariationDrafts((prev) => ({
                                      ...prev,
                                      [variation.id]: { ...prev[variation.id], weight: e.target.value },
                                    }))
                                  }
                                  style={{ width: '100px', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={draft.isAvailable}
                                    onChange={(e) =>
                                      setVariationDrafts((prev) => ({
                                        ...prev,
                                        [variation.id]: { ...prev[variation.id], isAvailable: e.target.checked },
                                      }))
                                    }
                                  />
                                  Available
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleSaveVariation(variation.id)}
                                  style={{
                                    padding: '0.4rem 1rem',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 600
                                  }}
                                  disabled={savingVariationId === variation.id}
                                >
                                  {savingVariationId === variation.id ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVariationDrafts((prev) => {
                                      const next = { ...prev };
                                      delete next[variation.id];
                                      return next;
                                    });
                                  }}
                                  style={{
                                    padding: '0.4rem 1rem',
                                    backgroundColor: '#64748b',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 600
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Add new variation block */}
                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Add New Size Variation</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Size/Name</label>
                      <input
                        type="text"
                        placeholder="Size (e.g., 0.5L, 1L, 2L)"
                        value={newVariation.size}
                        onChange={(e) => setNewVariation({ ...newVariation, size: e.target.value })}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div style={{ width: '110px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Price (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Price"
                        value={newVariation.price}
                        onChange={(e) => setNewVariation({ ...newVariation, price: e.target.value })}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div style={{ width: '130px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Compare at (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Compare price"
                        value={newVariation.compareAtPrice}
                        onChange={(e) => setNewVariation({ ...newVariation, compareAtPrice: e.target.value })}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div style={{ width: '110px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Weight (kg)</label>
                      <input
                        type="number"
                        step="0.001"
                        placeholder="Weight"
                        value={newVariation.weight}
                        onChange={(e) => setNewVariation({ ...newVariation, weight: e.target.value })}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', cursor: 'pointer', height: '34px' }}>
                      <input
                        type="checkbox"
                        checked={newVariation.isAvailable}
                        onChange={(e) => setNewVariation({ ...newVariation, isAvailable: e.target.checked })}
                      />
                      Available
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVariation}
                    style={{
                      padding: '0.5rem 1.25rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    Add Variation
                  </button>
                </div>
              </div>
            ) : (
              /* Customization System Panel */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* PART A: Variation Groups builder */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '12px' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                    1. Define Custom Variation Groups
                  </h3>
                  
                  {/* Create group form */}
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', background: 'white', padding: '1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 2, minWidth: '200px' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                        Group Title (e.g. Binding, Cover Material, Colour)
                      </label>
                      <input
                        type="text"
                        value={newGroupTitle}
                        onChange={(e) => setNewGroupTitle(e.target.value)}
                        placeholder="e.g. Binding Type"
                        style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
                      />
                    </div>
                    
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                        Selector Type
                      </label>
                      <select
                        value={newGroupType}
                        onChange={(e) => setNewGroupType(e.target.value as any)}
                        style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', backgroundColor: 'white' }}
                      >
                        <option value="option_buttons">Option Buttons</option>
                        <option value="colour_palette">Colour Palette</option>
                        <option value="image_selector">Image Selector</option>
                        <option value="text_input">Text Personalization Input</option>
                        <option value="uploads">Uploads</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddGroup}
                      style={{
                        padding: '0.65rem 1.5rem',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                    >
                      + Add Group
                    </button>
                  </div>

                  {/* Variation Groups list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {customizationOptions.map((group, groupIdx) => {
                      const groupInput = newValueInputs[group.id] || {
                        name: '', price: '', compareAtPrice: '', stock: '100', sku: '', hexCode: '#3b82f6', imageUrl: '', label: '', placeholder: '', charLimit: '100', photobookWidthCm: '', photobookHeightCm: '',
                      };
                      return (
                        <div key={group.id} style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                          {/* Group header */}
                          <div style={{ backgroundColor: '#f1f5f9', padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#3b82f6', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase' }}>
                                {group.type.replace('_', ' ')}
                              </span>
                              <input
                                type="text"
                                value={group.title}
                                onChange={(e) => {
                                  const updatedVal = e.target.value;
                                  setCustomizationOptions(customizationOptions.map(g => g.id === group.id ? { ...g, title: updatedVal } : g));
                                }}
                                style={{ fontWeight: 700, border: 'none', background: 'transparent', borderBottom: '1px dashed #94a3b8', fontSize: '1rem', color: '#1e293b', padding: '2px' }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button
                                type="button"
                                disabled={groupIdx === 0}
                                onClick={() => handleMoveGroup(groupIdx, 'up')}
                                style={{ padding: '0.25rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'white' }}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                disabled={groupIdx === customizationOptions.length - 1}
                                onClick={() => handleMoveGroup(groupIdx, 'down')}
                                style={{ padding: '0.25rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'white' }}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveGroup(group.id)}
                                style={{ padding: '0.25rem 0.6rem', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#ef4444', color: 'white', fontWeight: 600, fontSize: '0.85rem' }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          {/* Group content / Values list */}
                          <div style={{ padding: '1.25rem' }}>
                            {group.type === 'uploads' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#475569' }}>
                                  Upload options
                                </h4>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(group.polaroidUploadEnabled)}
                                    onChange={(e) => {
                                      void handleUploadsFlagChange(group.id, 'polaroidUploadEnabled', e.target.checked);
                                    }}
                                  />
                                  Enable Uploading of images for polaroids
                                </label>
                                {group.polaroidUploadEnabled ? (
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                                      Customer hint (polaroids)
                                    </label>
                                    <input
                                      type="text"
                                      value={group.polaroidUploadHint ?? ''}
                                      onChange={(e) => {
                                        setCustomizationOptions((prev) =>
                                          prev.map((entry) =>
                                            entry.id === group.id
                                              ? { ...entry, polaroidUploadHint: e.target.value }
                                              : entry,
                                          ),
                                        );
                                      }}
                                      onBlur={(e) => {
                                        void handleUploadsHintChange(group.id, 'polaroidUploadHint', e.target.value);
                                      }}
                                      placeholder="Upload photos for polaroids."
                                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                    />
                                  </div>
                                ) : null}
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(group.stripUploadEnabled)}
                                    onChange={(e) => {
                                      void handleUploadsFlagChange(group.id, 'stripUploadEnabled', e.target.checked);
                                    }}
                                  />
                                  Enable uploading of images for strips
                                </label>
                                {group.stripUploadEnabled ? (
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                                      Customer hint (strips)
                                    </label>
                                    <input
                                      type="text"
                                      value={group.stripUploadHint ?? ''}
                                      onChange={(e) => {
                                        setCustomizationOptions((prev) =>
                                          prev.map((entry) =>
                                            entry.id === group.id
                                              ? { ...entry, stripUploadHint: e.target.value }
                                              : entry,
                                          ),
                                        );
                                      }}
                                      onBlur={(e) => {
                                        void handleUploadsHintChange(group.id, 'stripUploadHint', e.target.value);
                                      }}
                                      placeholder="Upload photos for strips."
                                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                    />
                                  </div>
                                ) : null}
                                {group.polaroidUploadEnabled && group.stripUploadEnabled ? (
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                                      Customer hint (both enabled)
                                    </label>
                                    <input
                                      type="text"
                                      value={group.uploadHintBoth ?? ''}
                                      onChange={(e) => {
                                        setCustomizationOptions((prev) =>
                                          prev.map((entry) =>
                                            entry.id === group.id
                                              ? { ...entry, uploadHintBoth: e.target.value }
                                              : entry,
                                          ),
                                        );
                                      }}
                                      onBlur={(e) => {
                                        void handleUploadsHintChange(group.id, 'uploadHintBoth', e.target.value);
                                      }}
                                      placeholder="Upload photos for polaroids and strips."
                                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                    />
                                  </div>
                                ) : null}

                                {(() => {
                                  // Iterate backwards starting from groupIdx - 1
                                  let precedingGroup = null;
                                  for (let i = groupIdx - 1; i >= 0; i--) {
                                    const g = customizationOptions[i];
                                    if (g.type !== 'uploads' && g.type !== 'text_input') {
                                      precedingGroup = g;
                                      break;
                                    }
                                  }

                                  return (
                                    <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.75rem', fontStyle: 'italic' }}>
                                        💡 Note: Place the options variation group above to detect. If there is more than one options variation group above, then it will take the closest one just above it.
                                      </p>
                                      {precedingGroup ? (
                                        <div>
                                          <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                            Image upload limits by option (based on group &ldquo;{precedingGroup.title}&rdquo;):
                                          </h5>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {(group.maxImagesMap || []).map((entry, entryIdx) => (
                                              <div key={entryIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {precedingGroup.values && precedingGroup.values.length > 0 ? (
                                                  <select
                                                    value={entry.optionValue}
                                                    onChange={(e) => {
                                                      const updatedMap = [...(group.maxImagesMap || [])];
                                                      updatedMap[entryIdx] = { ...updatedMap[entryIdx], optionValue: e.target.value };
                                                      void handleUploadsMaxImagesMapChange(group.id, updatedMap);
                                                    }}
                                                    style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem', minWidth: '150px' }}
                                                  >
                                                    <option value="">Select Option</option>
                                                    {precedingGroup.values.map(v => (
                                                      <option key={v.id} value={v.name}>{v.name}</option>
                                                    ))}
                                                  </select>
                                                ) : (
                                                  <input
                                                    type="text"
                                                    value={entry.optionValue}
                                                    onChange={(e) => {
                                                      const updatedMap = [...(group.maxImagesMap || [])];
                                                      updatedMap[entryIdx] = { ...updatedMap[entryIdx], optionValue: e.target.value };
                                                      void handleUploadsMaxImagesMapChange(group.id, updatedMap);
                                                    }}
                                                    placeholder="Option Value"
                                                    style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem', width: '150px' }}
                                                  />
                                                )}
                                                
                                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>→ Max Images:</span>
                                                
                                                <input
                                                  type="number"
                                                  min="1"
                                                  value={entry.maxImages}
                                                  onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 1;
                                                    const updatedMap = [...(group.maxImagesMap || [])];
                                                    updatedMap[entryIdx] = { ...updatedMap[entryIdx], maxImages: val };
                                                    void handleUploadsMaxImagesMapChange(group.id, updatedMap);
                                                  }}
                                                  style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem', width: '80px' }}
                                                />

                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const updatedMap = (group.maxImagesMap || []).filter((_, i) => i !== entryIdx);
                                                    void handleUploadsMaxImagesMapChange(group.id, updatedMap);
                                                  }}
                                                  style={{ padding: '0.3rem 0.5rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                >
                                                  Remove
                                                </button>
                                              </div>
                                            ))}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const defaultOption = precedingGroup.values?.[0]?.name || '';
                                                const updatedMap = [...(group.maxImagesMap || []), { optionValue: defaultOption, maxImages: 1 }];
                                                void handleUploadsMaxImagesMapChange(group.id, updatedMap);
                                              }}
                                              style={{ alignSelf: 'flex-start', padding: '0.4rem 0.8rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                                            >
                                              Add limit mapping
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 500 }}>
                                          ⚠️ No options group found above this upload group. Place an option group (like options/buttons/palette) above to configure upload limit mappings.
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              <>
                            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 700, color: '#475569' }}>
                              Values in this variation group
                            </h4>
                            
                            {/* Current Values grid */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                              {group.values.length === 0 ? (
                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                                  No values created yet. Add values below.
                                </p>
                              ) : (
                                group.values.map((v, valIdx) => {
                                  const isEditing = editingValueId === v.id;
                                  if (isEditing && editingValueInput) {
                                    return (
                                      <div
                                        key={v.id}
                                        style={{
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '0.5rem',
                                          padding: '0.75rem 1rem',
                                          border: '1px solid #fde047',
                                          borderRadius: '12px',
                                          background: '#fefce8',
                                          fontSize: '0.85rem',
                                          width: '100%',
                                          maxWidth: '500px',
                                        }}
                                      >
                                        <div style={{ fontWeight: 700, color: '#854d0e', marginBottom: '0.25rem' }}>
                                          Editing &quot;{v.name || v.label || 'Value'}&quot;
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                          {group.type === 'text_input' ? (
                                            <>
                                              <div style={{ flex: 2, minWidth: '120px' }}>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#854d0e', marginBottom: '2px' }}>Label</label>
                                                <input
                                                  type="text"
                                                  value={editingValueInput.label}
                                                  onChange={(e) => setEditingValueInput({ ...editingValueInput, label: e.target.value })}
                                                  style={{ width: '100%', padding: '0.35rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem' }}
                                                />
                                              </div>
                                              <div style={{ flex: 2, minWidth: '120px' }}>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#854d0e', marginBottom: '2px' }}>Placeholder</label>
                                                <input
                                                  type="text"
                                                  value={editingValueInput.placeholder}
                                                  onChange={(e) => setEditingValueInput({ ...editingValueInput, placeholder: e.target.value })}
                                                  style={{ width: '100%', padding: '0.35rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem' }}
                                                />
                                              </div>
                                              <div style={{ width: '60px' }}>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#854d0e', marginBottom: '2px' }}>Limit</label>
                                                <input
                                                  type="number"
                                                  value={editingValueInput.charLimit}
                                                  onChange={(e) => setEditingValueInput({ ...editingValueInput, charLimit: e.target.value })}
                                                  style={{ width: '100%', padding: '0.35rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem' }}
                                                />
                                              </div>
                                            </>
                                          ) : (
                                            <div style={{ flex: 2, minWidth: '120px' }}>
                                              <label style={{ display: 'block', fontSize: '0.75rem', color: '#854d0e', marginBottom: '2px' }}>Name</label>
                                              <input
                                                type="text"
                                                value={editingValueInput.name}
                                                onChange={(e) => setEditingValueInput({ ...editingValueInput, name: e.target.value })}
                                                style={{ width: '100%', padding: '0.35rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem' }}
                                              />
                                            </div>
                                          )}

                                          {group.type === 'colour_palette' && (
                                            <div style={{ width: '90px' }}>
                                              <label style={{ display: 'block', fontSize: '0.75rem', color: '#854d0e', marginBottom: '2px' }}>Hex Color</label>
                                              <div style={{ display: 'flex', gap: '2px' }}>
                                                <input
                                                  type="color"
                                                  value={editingValueInput.hexCode}
                                                  onChange={(e) => setEditingValueInput({ ...editingValueInput, hexCode: e.target.value })}
                                                  style={{ width: '28px', height: '28px', padding: 0, border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                                                />
                                                <input
                                                  type="text"
                                                  value={editingValueInput.hexCode}
                                                  onChange={(e) => setEditingValueInput({ ...editingValueInput, hexCode: e.target.value })}
                                                  style={{ width: '55px', padding: '0.2rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem' }}
                                                />
                                              </div>
                                            </div>
                                          )}

                                          {group.type === 'image_selector' && (
                                            <div style={{ flex: 1, minWidth: '120px' }}>
                                              <label style={{ display: 'block', fontSize: '0.75rem', color: '#854d0e', marginBottom: '2px' }}>Photo</label>
                                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                      try {
                                                        const imageUrl = await uploadCustomizationImage(file, productId);
                                                        setEditingValueInput({ ...editingValueInput, imageUrl });
                                                        showToast('Image uploaded successfully!', 'success');
                                                      } catch {
                                                        showToast('Failed to upload image file', 'error');
                                                      }
                                                    }
                                                  }}
                                                  style={{ fontSize: '0.7rem', maxWidth: '100px' }}
                                                />
                                                {editingValueInput.imageUrl && (
                                                  <img src={editingValueInput.imageUrl} alt="" style={{ width: '22px', height: '22px', borderRadius: '4px', objectFit: 'cover' }} />
                                                )}
                                              </div>
                                            </div>
                                          )}

                                          {group.type === 'image_selector' && photobookEditorEnabled && (
                                            <>
                                              <div style={{ width: '90px' }}>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#854d0e', marginBottom: '2px' }}>Width (cm)</label>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.1"
                                                  value={editingValueInput.photobookWidthCm}
                                                  onChange={(e) => setEditingValueInput({ ...editingValueInput, photobookWidthCm: e.target.value })}
                                                  style={{ width: '100%', padding: '0.35rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem' }}
                                                />
                                              </div>
                                              <div style={{ width: '90px' }}>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#854d0e', marginBottom: '2px' }}>Height (cm)</label>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.1"
                                                  value={editingValueInput.photobookHeightCm}
                                                  onChange={(e) => setEditingValueInput({ ...editingValueInput, photobookHeightCm: e.target.value })}
                                                  style={{ width: '100%', padding: '0.35rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem' }}
                                                />
                                              </div>
                                            </>
                                          )}

                                          <div style={{ width: '70px' }}>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#854d0e', marginBottom: '2px' }}>Price (₹)</label>
                                            <input
                                              type="number"
                                              value={editingValueInput.price}
                                              onChange={(e) => setEditingValueInput({ ...editingValueInput, price: e.target.value })}
                                              style={{ width: '100%', padding: '0.35rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem' }}
                                            />
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                                          <button
                                            type="button"
                                            onClick={() => handleSaveValueEdit(group.id, v.id)}
                                            style={{ padding: '0.3rem 0.75rem', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}
                                          >
                                            ✓ Save Value
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingValueId(null);
                                              setEditingValueInput(null);
                                            }}
                                            style={{ padding: '0.3rem 0.75rem', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={v.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.4rem 0.75rem',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '20px',
                                        background: '#f8fafc',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        color: '#334155'
                                      }}
                                    >
                                      {group.type === 'colour_palette' && v.hexCode && (
                                        <span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: v.hexCode, border: '1px solid rgba(0,0,0,0.1)' }} />
                                      )}
                                      {group.type === 'image_selector' && v.imageUrl && (
                                        <img src={v.imageUrl} alt="" style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'cover' }} />
                                      )}
                                      {group.type === 'text_input' ? (
                                        <span>{v.label || 'Text field'}</span>
                                      ) : (
                                        <span>{v.name}</span>
                                      )}
                                      {photobookEditorEnabled && group.type === 'image_selector' && v.photobookWidthCm && v.photobookHeightCm ? (
                                        <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                                          {v.photobookWidthCm}×{v.photobookHeightCm} cm
                                        </span>
                                      ) : null}
                                      {v.price && <span style={{ color: '#10b981', fontSize: '0.75rem' }}>+₹{v.price}</span>}
                                      <div style={{ display: 'flex', gap: '2px', marginLeft: '0.25rem', borderLeft: '1px solid #cbd5e1', paddingLeft: '0.35rem' }}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingValueId(v.id);
                                            setEditingValueInput({
                                              name: v.name || '',
                                              price: v.price !== undefined ? String(v.price) : '',
                                              hexCode: v.hexCode || '#3b82f6',
                                              imageUrl: v.imageUrl || '',
                                              label: v.label || '',
                                              placeholder: v.placeholder || '',
                                              charLimit: v.charLimit !== undefined ? String(v.charLimit) : '100',
                                              photobookWidthCm: v.photobookWidthCm !== undefined ? String(v.photobookWidthCm) : '',
                                              photobookHeightCm: v.photobookHeightCm !== undefined ? String(v.photobookHeightCm) : '',
                                            });
                                          }}
                                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px', fontSize: '0.85rem' }}
                                          title="Edit this value details"
                                        >
                                          ✏️
                                        </button>
                                        <button type="button" disabled={valIdx === 0} onClick={() => handleMoveValue(group.id, valIdx, 'up')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px' }}>↑</button>
                                        <button type="button" disabled={valIdx === group.values.length - 1} onClick={() => handleMoveValue(group.id, valIdx, 'down')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px' }}>↓</button>
                                        <button type="button" onClick={() => handleRemoveValue(group.id, v.id)} style={{ border: 'none', background: 'transparent', color: '#ef4444', fontWeight: 700, cursor: 'pointer', marginLeft: '2px', fontSize: '1rem', padding: '0 2px' }} title="Delete this value">×</button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {/* Add new value form */}
                            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                              <h5 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                                + Add Variant Value
                              </h5>
                              
                              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                {group.type === 'text_input' ? (
                                  /* Text input dynamic fields */
                                  <>
                                    <div style={{ flex: 2, minWidth: '150px' }}>
                                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Personalization Label</label>
                                      <input
                                        type="text"
                                        value={groupInput.label}
                                        onChange={(e) => setNewValueInputs({
                                          ...newValueInputs,
                                          [group.id]: { ...groupInput, label: e.target.value }
                                        })}
                                        placeholder="e.g. Enter Name on Book"
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                      />
                                    </div>
                                    <div style={{ flex: 2, minWidth: '150px' }}>
                                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Placeholder</label>
                                      <input
                                        type="text"
                                        value={groupInput.placeholder}
                                        onChange={(e) => setNewValueInputs({
                                          ...newValueInputs,
                                          [group.id]: { ...groupInput, placeholder: e.target.value }
                                        })}
                                        placeholder="e.g. Max 15 letters"
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                      />
                                    </div>
                                    <div style={{ flex: 1, minWidth: '80px' }}>
                                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Char Limit</label>
                                      <input
                                        type="number"
                                        value={groupInput.charLimit}
                                        onChange={(e) => setNewValueInputs({
                                          ...newValueInputs,
                                          [group.id]: { ...groupInput, charLimit: e.target.value }
                                        })}
                                        placeholder="15"
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                      />
                                    </div>
                                  </>
                                ) : (
                                  /* Standard Name field */
                                  <div style={{ flex: 2, minWidth: '150px' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Variant Name</label>
                                    <input
                                      type="text"
                                      value={groupInput.name}
                                      onChange={(e) => setNewValueInputs({
                                        ...newValueInputs,
                                        [group.id]: { ...groupInput, name: e.target.value }
                                      })}
                                      placeholder="e.g. Hardcover or Cocoa Brown"
                                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                    />
                                  </div>
                                )}

                                {group.type === 'colour_palette' && (
                                  /* Color picker */
                                  <div style={{ flex: 1, minWidth: '100px' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Hex Colour</label>
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                      <input
                                        type="color"
                                        value={groupInput.hexCode}
                                        onChange={(e) => setNewValueInputs({
                                          ...newValueInputs,
                                          [group.id]: { ...groupInput, hexCode: e.target.value }
                                        })}
                                        style={{ width: '38px', height: '34px', padding: '0', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }}
                                      />
                                      <input
                                        type="text"
                                        value={groupInput.hexCode}
                                        onChange={(e) => setNewValueInputs({
                                          ...newValueInputs,
                                          [group.id]: { ...groupInput, hexCode: e.target.value }
                                        })}
                                        style={{ width: '70px', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem' }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {group.type === 'image_selector' && (
                                  /* Image selector file upload */
                                  <div style={{ flex: 2, minWidth: '180px' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Upload Photo</label>
                                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handleValueFileChange(group.id, file);
                                        }}
                                        style={{ fontSize: '0.75rem', maxWidth: '160px' }}
                                      />
                                      {groupInput.imageUrl && (
                                        <img src={groupInput.imageUrl} alt="" style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                                      )}
                                    </div>
                                  </div>
                                )}

                                {group.type === 'image_selector' && photobookEditorEnabled && (
                                  <>
                                    <div style={{ width: '90px' }}>
                                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Width (cm)</label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={groupInput.photobookWidthCm}
                                        onChange={(e) => setNewValueInputs({
                                          ...newValueInputs,
                                          [group.id]: { ...groupInput, photobookWidthCm: e.target.value }
                                        })}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                      />
                                    </div>
                                    <div style={{ width: '90px' }}>
                                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Height (cm)</label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={groupInput.photobookHeightCm}
                                        onChange={(e) => setNewValueInputs({
                                          ...newValueInputs,
                                          [group.id]: { ...groupInput, photobookHeightCm: e.target.value }
                                        })}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                      />
                                    </div>
                                  </>
                                )}

                                {/* Price modification for this variation value */}
                                <div style={{ width: '90px' }}>
                                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Extra Price (₹)</label>
                                  <input
                                    type="number"
                                    value={groupInput.price}
                                    onChange={(e) => setNewValueInputs({
                                      ...newValueInputs,
                                      [group.id]: { ...groupInput, price: e.target.value }
                                    })}
                                    placeholder="+0"
                                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleAddValue(group.id)}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#2563eb',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Add Value
                                </button>
                              </div>
                            </div>
                              </>
                            )}

                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* PART B: Combinations List & Pricing */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                        2. Variation Combinations & Stock Matrix
                      </h3>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                        Generate and manage details (Price, compare-at, stock, image) for specific notebook combinations.
                      </p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleAutoGenerateCombinations}
                      style={{
                        padding: '0.55rem 1.25rem',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(59,130,246,0.2)'
                      }}
                    >
                      ⚡ Auto-Generate Combinations
                    </button>
                  </div>

                  {customizationCombinations.length > 0 && (
                    /* Bulk operations tools */
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', width: '100%', marginBottom: '-0.75rem' }}>
                        Bulk Combination Tools
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="number"
                          value={bulkPrice}
                          onChange={(e) => setBulkPrice(e.target.value)}
                          placeholder="Bulk Price (₹)"
                          style={{ padding: '0.45rem', border: '1px solid #bfdbfe', borderRadius: '4px', fontSize: '0.85rem', width: '110px' }}
                        />
                        <button
                          type="button"
                          onClick={handleBulkPriceApply}
                          style={{ padding: '0.45rem 0.85rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Apply Price
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="number"
                          value={bulkStock}
                          onChange={(e) => setBulkStock(e.target.value)}
                          placeholder="Bulk Stock"
                          style={{ padding: '0.45rem', border: '1px solid #bfdbfe', borderRadius: '4px', fontSize: '0.85rem', width: '100px' }}
                        />
                        <button
                          type="button"
                          onClick={handleBulkStockApply}
                          style={{ padding: '0.45rem 0.85rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Apply Stock
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Combinations grid table */}
                  {customizationCombinations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontStyle: 'italic', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                      No combinations generated. Click &quot;⚡ Auto-Generate Combinations&quot; above.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {customizationCombinations.map((comb) => {
                        // Resolve text labels for this combination
                        const combinationLabels = Object.entries(comb.combinationKeys).map(([groupId, valueId]) => {
                          const grp = customizationOptions.find(g => g.id === groupId);
                          const val = grp?.values.find(v => v.id === valueId);
                          return {
                            groupTitle: grp?.title || 'Group',
                            valueName: val?.name || 'Value'
                          };
                        });

                        return (
                          <div
                            key={comb.id}
                            style={{
                              background: comb.isActive ? 'white' : '#f1f5f9',
                              opacity: comb.isActive ? 1 : 0.7,
                              border: '1px solid #cbd5e1',
                              borderRadius: '8px',
                              padding: '1rem',
                              display: 'flex',
                              gap: '1rem',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                            }}
                          >
                            
                            {/* Comb image upload */}
                            <div style={{ position: 'relative', width: '48px', height: '48px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              {comb.imageUrl ? (
                                <img src={comb.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>🖼️</span>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleCombinationFileChange(comb.id, file);
                                }}
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                title="Upload Custom Photo for this variation combination"
                              />
                            </div>

                            {/* Comb labels */}
                            <div style={{ flex: '2', minWidth: '180px' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                {combinationLabels.map((lbl, idx) => (
                                  <span key={idx} style={{ fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', color: '#334155', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                                    <strong style={{ color: '#64748b' }}>{lbl.groupTitle}:</strong> {lbl.valueName}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Comb Inputs */}
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                              <div style={{ width: '90px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '2px' }}>Price (₹)</label>
                                <input
                                  type="number"
                                  placeholder="Use base"
                                  value={comb.price === undefined ? '' : comb.price}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                    setCustomizationCombinations(customizationCombinations.map(c => c.id === comb.id ? { ...c, price: val } : c));
                                  }}
                                  style={{ width: '100%', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                />
                              </div>

                              <div style={{ width: '90px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '2px' }}>Compare (₹)</label>
                                <input
                                  type="number"
                                  placeholder="Use base"
                                  value={comb.compareAtPrice === undefined ? '' : comb.compareAtPrice}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                    setCustomizationCombinations(customizationCombinations.map(c => c.id === comb.id ? { ...c, compareAtPrice: val } : c));
                                  }}
                                  style={{ width: '100%', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                />
                              </div>

                              <div style={{ width: '70px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '2px' }}>Stock</label>
                                <input
                                  type="number"
                                  value={comb.stock === undefined ? '' : comb.stock}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : 0;
                                    setCustomizationCombinations(customizationCombinations.map(c => c.id === comb.id ? { ...c, stock: val } : c));
                                  }}
                                  style={{ width: '100%', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                />
                              </div>

                              <div style={{ width: '110px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '2px' }}>SKU</label>
                                <input
                                  type="text"
                                  value={comb.sku || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCustomizationCombinations(customizationCombinations.map(c => c.id === comb.id ? { ...c, sku: val } : c));
                                  }}
                                  style={{ width: '100%', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                />
                              </div>

                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', height: '100%', marginTop: '12px' }}>
                                <input
                                  type="checkbox"
                                  checked={comb.isActive}
                                  onChange={(e) => {
                                    const val = e.target.checked;
                                    setCustomizationCombinations(customizationCombinations.map(c => c.id === comb.id ? { ...c, isActive: val } : c));
                                  }}
                                />
                                Active
                              </label>

                              <button
                                type="button"
                                onClick={() => setCustomizationCombinations(customizationCombinations.filter(c => c.id !== comb.id))}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#ef4444',
                                  fontWeight: 700,
                                  fontSize: '1.2rem',
                                  cursor: 'pointer',
                                  marginTop: '12px',
                                  padding: '0 4px'
                                }}
                                title="Remove this combination override"
                              >
                                ×
                              </button>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Global Tab Save warning button */}
                <div style={{ padding: '1rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: '#b45309' }}>
                    ⚠️ <strong>Unsaved Changes:</strong> Remember to click the global &quot;Save Changes&quot; button at the bottom of the page or in the footer to commit these variations to the database!
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveProduct}
                    disabled={saving}
                    style={{
                      padding: '0.5rem 1.25rem',
                      backgroundColor: '#d97706',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Product Now'}
                  </button>
                </div>

              </div>
            )}
          </div>
        )}

        {/* Folding Titles Tab */}
        {activeTab === 'accordions' && (
          <div className={styles.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
              <div>
                <h2>Folding Titles / Description Sections (Accordion)</h2>
                <p className={styles.imagesHint} style={{ margin: 0 }}>
                  Add expandable folding sections below the main description (e.g., Size, Paper Quality, What&apos;s Inside?).
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveAccordionItems}
                disabled={savingAccordions || saving}
                className={styles.saveButton}
                style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem' }}
              >
                {savingAccordions ? 'Saving Folding Titles...' : 'Save Folding Titles'}
              </button>
            </div>

            {accordionItems.length > 0 && (
              <div className={styles.variationsList} style={{ marginTop: '1.25rem' }}>
                {accordionItems.map((item, index) => (
                  <div
                    key={index}
                    className={styles.variationCard}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      alignItems: 'stretch',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      background: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          background: '#f1f5f9',
                          color: '#475569',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          userSelect: 'none',
                        }}
                      >
                        #{index + 1}
                      </span>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => handleUpdateAccordionItem(index, 'title', e.target.value)}
                        placeholder="Section Title (e.g. Size & Specifications)"
                        className={styles.input}
                        style={{ fontWeight: 600, flex: 1, minWidth: '220px' }}
                      />
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleMoveAccordionItem(index, 'up')}
                          disabled={index === 0}
                          style={{
                            padding: '0.4rem 0.65rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: index === 0 ? '#f8fafc' : '#ffffff',
                            cursor: index === 0 ? 'not-allowed' : 'pointer',
                            opacity: index === 0 ? 0.4 : 1,
                            fontWeight: 700,
                          }}
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveAccordionItem(index, 'down')}
                          disabled={index === accordionItems.length - 1}
                          style={{
                            padding: '0.4rem 0.65rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: index === accordionItems.length - 1 ? '#f8fafc' : '#ffffff',
                            cursor: index === accordionItems.length - 1 ? 'not-allowed' : 'pointer',
                            opacity: index === accordionItems.length - 1 ? 0.4 : 1,
                            fontWeight: 700,
                          }}
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAccordionItem(index)}
                          className={styles.deleteButton}
                          style={{ padding: '0.4rem 0.8rem' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Description Content (HTML Editor)</label>
                      <RichTextEditor
                        value={item.htmlContent}
                        onChange={(val) => handleUpdateAccordionItem(index, 'htmlContent', val)}
                        placeholder="Enter description content..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.addSection} style={{ marginTop: '1.5rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: '#1e293b' }}>+ Add New Folding Section</h3>
              <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>New Folding Section Title</label>
                <input
                  type="text"
                  value={newAccordionTitle}
                  onChange={(e) => setNewAccordionTitle(e.target.value)}
                  placeholder="e.g. What's Inside? or Size & Details"
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup} style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>New Folding Section Content (HTML Editor)</label>
                <RichTextEditor
                  value={newAccordionHtmlContent}
                  onChange={setNewAccordionHtmlContent}
                  placeholder="Enter detailed description content..."
                />
              </div>
              <button
                type="button"
                onClick={handleAddAccordionItem}
                className={styles.addButton}
                style={{ padding: '0.6rem 1.25rem' }}
              >
                + Add Accordion Section
              </button>
            </div>

            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Tip: Click <strong>Save Folding Titles</strong> or <strong>Save All Changes</strong> to persist changes.
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleSaveAccordionItems}
                  disabled={savingAccordions || saving}
                  className={styles.saveButton}
                  style={{ backgroundColor: '#0284c7' }}
                >
                  {savingAccordions ? 'Saving...' : 'Save Folding Titles'}
                </button>
                <button
                  onClick={handleSaveProduct}
                  disabled={saving || savingAccordions}
                  className={styles.saveButton}
                >
                  {saving ? 'Saving...' : 'Save All Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      <MediaLibraryModal
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleMediaLibrarySelect}
        multiple={mediaPickerMultiple}
        title="Select Images from Cloudinary"
      />
    </div>
  );
}
