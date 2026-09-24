'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { adminProductsApi } from '@/lib/api';
import { getAllCategories, Category } from '@/lib/api/categories';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import adminStyles from '../../admin-styles.module.css';
import styles from './page.module.css';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { sanitizeHtml } from '@/lib/utils/sanitizeHtml';
import { uploadCustomizationImage } from '@/lib/admin/uploadCustomizationImage';
import { VariationGroup, VariantValue, ProductCustomizationCombination, ProductSizeGuide, SizeGuideTableRow } from '@/types';
import MediaLibraryModal from '@/components/admin/MediaLibraryModal';
import { MediaResource } from '@/lib/api/media';

interface ProductVariation {
  size: string;
  price: string;
  compareAtPrice?: string;
  weight?: string;
}

interface DeliveryPincodeConfig {
  pincode: string;
  deliveryTimeText?: string;
}

const DEFAULT_SIZE_GUIDE_ROWS: SizeGuideTableRow[] = [
  { size: 'XS', bust: '32"', waist: '25"', hip: '35"' },
  { size: 'S', bust: '34"', waist: '27"', hip: '37"' },
  { size: 'M', bust: '36"', waist: '29"', hip: '39"' },
  { size: 'L', bust: '38"', waist: '31"', hip: '41"' },
  { size: 'XL', bust: '40"', waist: '33"', hip: '43"' },
  { size: 'XXL', bust: '42"', waist: '35"', hip: '45"' },
];

/**
 * Admin Create New Product Page
 * Create a new product
 */
export default function AdminCreateProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [imagePreviews, setImagePreviews] = useState<Array<{ file?: File; preview: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<'gallery' | 'size-guide'>('gallery');

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [weight, setWeight] = useState('0.1');
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
  const [deliveryTimeText, setDeliveryTimeText] = useState('');
  const [deliveryPincodeConfigs, setDeliveryPincodeConfigs] = useState<DeliveryPincodeConfig[]>([]);
  const [newDeliveryPincode, setNewDeliveryPincode] = useState('');
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [newVariation, setNewVariation] = useState<ProductVariation>({ size: '', price: '', compareAtPrice: '', weight: '0.1' });

  // Size Guide States
  const [sizeGuide, setSizeGuide] = useState<ProductSizeGuide>({
    enabled: false,
    type: 'table',
    imageUrl: '',
    tableRows: DEFAULT_SIZE_GUIDE_ROWS,
  });
  const [sizeGuideImageFile, setSizeGuideImageFile] = useState<File | null>(null);
  const [sizeGuideImagePreview, setSizeGuideImagePreview] = useState<string>('');

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
  }>>({});
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkStock, setBulkStock] = useState('');

  // Accordion states and handlers
  interface AccordionItem {
    title: string;
    htmlContent: string;
  }
  const [accordionItems, setAccordionItems] = useState<AccordionItem[]>([]);
  const [newAccordionTitle, setNewAccordionTitle] = useState('');
  const [newAccordionHtmlContent, setNewAccordionHtmlContent] = useState('');

  const handleAddAccordionItem = () => {
    if (!newAccordionTitle.trim() || !newAccordionHtmlContent.trim()) {
      setError('Both accordion title and description content are required');
      return;
    }
    setAccordionItems([
      ...accordionItems,
      { title: newAccordionTitle.trim(), htmlContent: newAccordionHtmlContent.trim() }
    ]);
    setNewAccordionTitle('');
    setNewAccordionHtmlContent('');
    setError('');
  };

  const handleRemoveAccordionItem = (index: number) => {
    setAccordionItems(accordionItems.filter((_, i) => i !== index));
  };

  const handleUpdateAccordionItem = (index: number, field: keyof AccordionItem, value: string) => {
    setAccordionItems(
      accordionItems.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await getAllCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleAddVariation = () => {
    if (!newVariation.size || !newVariation.price) {
      setError('Variation size and price are required');
      return;
    }
    if (newVariation.compareAtPrice?.trim()) {
      const p = parseFloat(newVariation.price);
      const c = parseFloat(newVariation.compareAtPrice);
      if (Number.isFinite(p) && Number.isFinite(c) && c < p) {
        setError('Compare at price must be greater than or equal to the variation price');
        return;
      }
    }
    setVariations([...variations, { ...newVariation, compareAtPrice: newVariation.compareAtPrice || '', weight: newVariation.weight || '0.1' }]);
    setNewVariation({ size: '', price: '', compareAtPrice: '', weight: '0.1' });
    setSellingPrice('');
    setCompareAtPrice('');
    setError('');
  };

  const handleRemoveVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index));
  };

  const handleUpdateVariation = (
    index: number,
    field: keyof ProductVariation,
    value: string
  ) => {
    setVariations((prev) =>
      prev.map((variation, variationIndex) =>
        variationIndex === index ? { ...variation, [field]: value } : variation
      )
    );
  };

  const handleImageChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImages: Array<{ file: File; preview: string }> = [];

    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          newImages.push({
            file,
            preview: reader.result as string,
          });

          // Update state when all files are read
          if (newImages.length === Array.from(files).length) {
            setImagePreviews((prev) => [...prev, ...newImages]);
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleImageChange(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleImageChange(e.dataTransfer.files);
  };

  const removeImage = (index: number) => {
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllImages = () => {
    setImagePreviews([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMediaLibrarySelect = (selected: MediaResource[]) => {
    if (!selected || selected.length === 0) return;
    if (mediaPickerTarget === 'size-guide') {
      const firstUrl = selected[0]?.url || selected[0]?.secure_url || '';
      setSizeGuideImagePreview(firstUrl);
      setSizeGuide((prev) => ({ ...prev, imageUrl: firstUrl }));
      return;
    }
    const newItems = selected.map((item) => ({
      preview: item.url || item.secure_url || '',
    }));
    setImagePreviews((prev) => [...prev, ...newItems]);
  };

  const handleAddSizeGuideRow = () => {
    setSizeGuide((prev) => ({
      ...prev,
      tableRows: [
        ...(prev.tableRows || []),
        { size: '', bust: '', waist: '', hip: '' },
      ],
    }));
  };

  const handleUpdateSizeGuideRow = (index: number, field: keyof SizeGuideTableRow, val: string) => {
    setSizeGuide((prev) => ({
      ...prev,
      tableRows: (prev.tableRows || []).map((row, i) =>
        i === index ? { ...row, [field]: val } : row
      ),
    }));
  };

  const handleRemoveSizeGuideRow = (index: number) => {
    setSizeGuide((prev) => ({
      ...prev,
      tableRows: (prev.tableRows || []).filter((_, i) => i !== index),
    }));
  };

  const handleResetSizeGuideRows = () => {
    setSizeGuide((prev) => ({
      ...prev,
      tableRows: DEFAULT_SIZE_GUIDE_ROWS,
    }));
  };

  // Customization Handlers
  const handleUploadsFlagChange = (
    groupId: string,
    field: 'polaroidUploadEnabled' | 'stripUploadEnabled',
    checked: boolean,
  ) => {
    setCustomizationOptions((prev) =>
      prev.map((group) => (group.id === groupId ? { ...group, [field]: checked } : group)),
    );
    if (field === 'polaroidUploadEnabled') {
      setPolaroidUploadEnabled(checked);
    } else {
      setStripUploadEnabled(checked);
    }
  };

  const handleUploadsHintChange = (
    groupId: string,
    field: 'polaroidUploadHint' | 'stripUploadHint' | 'uploadHintBoth',
    value: string,
  ) => {
    setCustomizationOptions((prev) =>
      prev.map((group) => (group.id === groupId ? { ...group, [field]: value } : group)),
    );
  };

  const handleUploadsMaxImagesMapChange = (
    groupId: string,
    maxImagesMap: Array<{ optionValue: string; maxImages: number }>,
  ) => {
    setCustomizationOptions((prev) =>
      prev.map((group) => (group.id === groupId ? { ...group, maxImagesMap } : group)),
    );
  };

  const handleAddGroup = () => {
    if (!newGroupTitle.trim()) {
      setError('Please enter a variation title (e.g. Binding, Color, Size)');
      return;
    }
    if (newGroupType === 'uploads' && customizationOptions.some((group) => group.type === 'uploads')) {
      setError('An uploads variation group already exists.');
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
    setError('');
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
        charLimit: '100'
      }
    }));
  };

  const handleRemoveGroup = (groupId: string) => {
    if (!confirm('Are you sure you want to remove this variation group? This will also wipe out values.')) return;

    const removedGroup = customizationOptions.find((group) => group.id === groupId);
    const updatedOptions = customizationOptions.filter((group) => group.id !== groupId);
    setCustomizationOptions(updatedOptions);

    if (removedGroup?.type === 'uploads') {
      setPolaroidUploadEnabled(false);
      setStripUploadEnabled(false);
    }
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
        setError('Please enter a label for personalization field');
        return;
      }
    } else {
      if (!inputs.name.trim()) {
        setError('Please enter a variant name');
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
        charLimit: '100'
      }
    }));
    setError('');
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
      const imageUrl = await uploadCustomizationImage(file);
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
            charLimit: '100'
          },
          imageUrl,
        }
      }));
    } catch (err) {
      setError('Failed to upload image file');
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
          };
        })
      };
    }));
    
    setEditingValueId(null);
    setEditingValueInput(null);
  };

  const handleCombinationFileChange = async (combinationId: string, file: File) => {
    try {
      const imageUrl = await uploadCustomizationImage(file);
      setCustomizationCombinations(customizationCombinations.map(c => {
        if (c.id === combinationId) {
          return {
            ...c,
            imageUrl,
          };
        }
        return c;
      }));
    } catch (err) {
      setError('Failed to upload image file');
    }
  };

  const handleAutoGenerateCombinations = () => {
    const combinableGroups = customizationOptions.filter(
      (g) => g.type !== 'text_input' && g.type !== 'uploads' && g.values.length > 0,
    );
    if (combinableGroups.length === 0) {
      setError('Add at least one variation group (Binding, Color, Size, etc.) and values to generate combinations.');
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
    setError('');
  };

  const handleBulkPriceApply = () => {
    const val = parseFloat(bulkPrice);
    if (isNaN(val) || val < 0) {
      setError('Please enter a valid price for bulk update');
      return;
    }
    setCustomizationCombinations(customizationCombinations.map(c => ({
      ...c,
      price: val
    })));
    setBulkPrice('');
  };

  const handleBulkStockApply = () => {
    const val = parseInt(bulkStock);
    if (isNaN(val) || val < 0) {
      setError('Please enter a valid stock number for bulk update');
      return;
    }
    setCustomizationCombinations(customizationCombinations.map(c => ({
      ...c,
      stock: val
    })));
    setBulkStock('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate
    if (!name) {
      setError('Product name is required');
      setLoading(false);
      return;
    }

    if (variations.length === 0 && !isCustomizable) {
      if (!sellingPrice.trim() || !compareAtPrice.trim()) {
        setError('Set both Selling Price and Compare At Price, or add at least one variation with its own price.');
        setLoading(false);
        return;
      }
    }

    if (sellingPrice && compareAtPrice) {
      const selling = parseFloat(sellingPrice);
      const compare = parseFloat(compareAtPrice);
      if (Number.isFinite(selling) && Number.isFinite(compare) && selling > compare) {
        setError('Selling Price cannot be greater than Compare At Price');
        setLoading(false);
        return;
      }
    }

    // If variations exist, at least one variation is required
    if (variations.length > 0 && variations.some(v => !v.size || !v.price)) {
      setError('All variations must have both size and price');
      setLoading(false);
      return;
    }

    for (const v of variations) {
      if (!v.compareAtPrice?.trim()) continue;
      const p = parseFloat(v.price);
      const c = parseFloat(v.compareAtPrice);
      if (Number.isFinite(p) && Number.isFinite(c) && c < p) {
        setError(`Compare at price must be ≥ selling price for size "${v.size}"`);
        setLoading(false);
        return;
      }
    }

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', sanitizeHtml(description));
      // Use selling price as the main price field
      if (variations.length === 0) {
        const mainPrice = sellingPrice || '0';
        formData.append('pricePerLitre', mainPrice);
        formData.append('sellingPrice', mainPrice);
        formData.append('compareAtPrice', compareAtPrice);
      } else {
        formData.append('pricePerLitre', variations[0].price);
      }
      if (taxPercent.trim() !== '') {
        formData.append('taxPercent', taxPercent);
      }
      formData.append('quantity', quantity);
      formData.append('lowStockThreshold', lowStockThreshold);
      formData.append('maxQuantity', maxQuantity);
      if (categoryId) {
        formData.append('categoryId', categoryId);
      }
      formData.append('isActive', isActive.toString());
      formData.append('isMembershipEligible', isMembershipEligible.toString());
      formData.append('isNationwideDelivery', isNationwideDelivery.toString());
      formData.append('isCustomizable', isCustomizable.toString());
      formData.append('photobookEditorEnabled', photobookEditorEnabled.toString());
      formData.append('buyNowEnabled', buyNowEnabled.toString());
      formData.append('buyAgainEnabled', buyAgainEnabled.toString());
      formData.append('hoverNextImage', hoverNextImage.toString());
      const uploadsGroup = customizationOptions.find((group) => group.type === 'uploads');
      formData.append(
        'polaroidUploadEnabled',
        String(uploadsGroup ? Boolean(uploadsGroup.polaroidUploadEnabled) : false),
      );
      formData.append(
        'stripUploadEnabled',
        String(uploadsGroup ? Boolean(uploadsGroup.stripUploadEnabled) : false),
      );
      if (deliveryTimeText.trim() !== '') {
        formData.append('deliveryTimeText', deliveryTimeText.trim());
      }
      formData.append('deliveryPincodes', JSON.stringify(deliveryPincodeConfigs));
      formData.append('weight', weight);
      formData.append('accordionItems', JSON.stringify(accordionItems));
      formData.append('customizationOptions', JSON.stringify(customizationOptions));
      formData.append('customizationCombinations', JSON.stringify(customizationCombinations));
      formData.append('sizeGuide', JSON.stringify({
        enabled: sizeGuide.enabled,
        type: sizeGuide.type,
        imageUrl: sizeGuideImagePreview || sizeGuide.imageUrl || '',
        tableRows: sizeGuide.tableRows || [],
      }));

      // Use first image as main product image
      if (imagePreviews.length > 0) {
        if (imagePreviews[0].file) {
          formData.append('image', imagePreviews[0].file);
        } else {
          formData.append('imageUrl', imagePreviews[0].preview);
        }
      }

      const product = await adminProductsApi.create(formData);

      // Upload additional images (skip first one as it's already uploaded as main image)
      if (imagePreviews.length > 1) {
        for (let i = 1; i < imagePreviews.length; i++) {
          try {
            const item = imagePreviews[i];
            await adminProductsApi.addImage(product.id, item.file || item.preview, i);
          } catch (err) {
            console.error('Failed to add image:', err);
          }
        }
      }

      // Create variations if any
      if (variations.length > 0) {
        for (const variation of variations) {
          try {
            let compareNum: number | null = null;
            if (variation.compareAtPrice?.trim()) {
              const x = parseFloat(variation.compareAtPrice);
              if (Number.isFinite(x)) compareNum = x;
            }
            await adminProductsApi.addVariation(product.id, {
              size: variation.size,
              price: parseFloat(variation.price),
              compareAtPrice: compareNum,
              weight: parseFloat(variation.weight || '0.1'),
              isAvailable: true,
              displayOrder: variations.indexOf(variation),
            });
          } catch (err) {
            console.error('Failed to create variation:', err);
          }
        }
      }

      alert('Product created successfully!');
      router.push(`/admin/products/${product.id}`);
    } catch (err: any) {
      console.error('Failed to create product:', err);
      setError(err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button
          onClick={() => router.back()}
          className={styles.backButton}
        >
          ← Back to Products
        </button>
        <h1 className={adminStyles.adminPageTitle}>Create New Product</h1>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.formContainer}>
        {/* Basic Information Section */}
        <div className={styles.formSection}>
          <h2 className={styles.formSectionTitle}>Basic Information</h2>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Product Name<span className={styles.formLabelRequired}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={styles.formInput}
              placeholder="e.g., Fresh Cow Milk"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description</label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Describe your product..."
            />
          </div>

          {variations.length === 0 && (
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Selling Price (₹)<span className={styles.formLabelRequired}>*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  required={variations.length === 0}
                  min="0"
                  className={styles.formInput}
                  placeholder="0.00"
                />
                <p className={styles.formHelpText}>
                  The current selling price of the product. This field is only shown when no variations are added.
                </p>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Compare At Price (₹)<span className={styles.formLabelRequired}>*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={compareAtPrice}
                  onChange={(e) => setCompareAtPrice(e.target.value)}
                  required={variations.length === 0}
                  min="0"
                  className={styles.formInput}
                  placeholder="0.00"
                />
                <p className={styles.formHelpText}>
                  Original price (shown with strikethrough for discounts)
                </p>
              </div>
            </div>
          )}

          {variations.length > 0 && (
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <div style={{
                  padding: '0.75rem 1rem',
                  background: '#eff6ff',
                  borderRadius: '8px',
                  border: '1px solid #bfdbfe',
                  color: '#1e40af',
                  fontSize: '0.9rem',
                  lineHeight: '1.5'
                }}>
                  <strong>Note:</strong> Since you have added variations with individual prices, the base price fields are hidden. Each variation will use its own price.
                </div>
              </div>
            </div>
          )}

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tax (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={taxPercent}
                onChange={(e) => setTaxPercent(e.target.value)}
                className={styles.formInput}
                placeholder="0"
              />
              <p className={styles.formHelpText}>
                Optional product tax percentage. If empty, 0% is used.
              </p>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Default Product Weight (kg)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={styles.formInput}
                placeholder="e.g. 0.1 for 100g, 1 for 1kg"
              />
              <p className={styles.formHelpText}>
                Used as the shipping weight if the product has no variations.
              </p>
            </div>
          </div>
        </div>

        {/* Inventory & Category Section */}
        <div className={styles.formSection}>
          <h2 className={styles.formSectionTitle}>Inventory & Category</h2>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Quantity in Stock</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="0"
                className={styles.formInput}
                placeholder="0"
              />
              <p className={styles.formHelpText}>
                Note: Quantity will not be displayed to customers
              </p>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Low Stock Threshold</label>
              <input
                type="number"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                min="0"
                className={styles.formInput}
                placeholder="10"
              />
              <p className={styles.formHelpText}>
                Show &quot;Low in stock&quot; when quantity falls below this number
              </p>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Max Quantity Per Order</label>
              <input
                type="number"
                value={maxQuantity}
                onChange={(e) => setMaxQuantity(e.target.value)}
                min="1"
                className={styles.formInput}
                placeholder="99"
              />
              <p className={styles.formHelpText}>
                Admin-set maximum quantity allowed for this product.
              </p>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={styles.formSelect}
            >
              <option value="">No Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className={`${styles.formHelpText} ${styles.formHelpTextError}`}>
                No categories found. Create categories in Admin &gt; More &gt; Categories
              </p>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Product Delivery Pincodes</label>
            <label
              className={styles.formHelpText}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}
            >
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
                      className={styles.formInput}
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
                className={styles.formInput}
                placeholder="6-digit pincode"
              />
              <button
                type="button"
                onClick={() => {
                  if (newDeliveryPincode.length !== 6) return;
                  if (deliveryPincodeConfigs.some((x) => x.pincode === newDeliveryPincode)) return;
                  setDeliveryPincodeConfigs((prev) => [...prev, { pincode: newDeliveryPincode, deliveryTimeText: '' }]);
                  setNewDeliveryPincode('');
                }}
                className={styles.addVariationButton}
                style={{ alignSelf: 'flex-end' }}
              >
                Add
              </button>
            </div>
            <p className={styles.formHelpText}>
              Saved pincodes always use their matching delivery time text. When nationwide delivery is enabled, other
              valid pincodes show 3-5 Days delivery. When it is disabled, other pincodes show Not deliverable.
            </p>
          </div>
        </div>

        {/* Product Images Section */}
        <div className={styles.formSection}>
          <h2 className={styles.formSectionTitle}>Product Images</h2>

          <div className={styles.imageUploadSection}>
            <div
              className={`${styles.imageUploadArea} ${isDragging ? styles.dragover : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => setMediaPickerOpen(true)}
              style={{ cursor: 'pointer', textAlign: 'center', padding: '1.75rem 1.5rem' }}
            >
              <svg
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ margin: '0 auto 0.75rem', color: '#0070f3' }}
              >
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 12v9m0-9l-3 3m3-3l3 3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div style={{ marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMediaPickerOpen(true);
                  }}
                  style={{
                    padding: '0.65rem 1.35rem',
                    background: '#0070f3',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 2px 6px rgba(0, 112, 243, 0.3)',
                  }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.25">
                    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 12v9m0-9l-3 3m3-3l3 3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>{imagePreviews.length === 0 ? '+ Add from Media Library' : '+ Add More from Media Library'}</span>
                </button>
              </div>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>
                Click or drop files here to open Media Library and select or upload images
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileInputChange}
              className={styles.fileInput}
            />

            {imagePreviews.length > 0 && (
              <>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '1.5rem',
                  marginBottom: '1rem'
                }}>
                  <p className={styles.formHelpText} style={{ margin: 0 }}>
                    {imagePreviews.length} image{imagePreviews.length !== 1 ? 's' : ''} selected
                    {imagePreviews.length > 0 && (
                      <span style={{ marginLeft: '0.5rem', color: '#059669' }}>
                        (First image will be the main product image)
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={clearAllImages}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                  >
                    Clear All
                  </button>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '1rem',
                  marginTop: '1rem'
                }}>
                  {imagePreviews.map((imageData, index) => (
                    <div key={index} style={{ position: 'relative' }}>
                      <div style={{
                        position: 'relative',
                        paddingBottom: '100%',
                        background: '#f3f4f6',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: index === 0 ? '3px solid #10b981' : '2px solid #e5e7eb'
                      }}>
                        <img
                          src={imageData.preview}
                          alt={`Preview ${index + 1}`}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                        {index === 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '0.5rem',
                            left: '0.5rem',
                            background: '#10b981',
                            color: 'white',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}>
                            Main
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className={styles.removeImageButton}
                          style={{
                            top: '0.5rem',
                            right: '0.5rem',
                            width: '28px',
                            height: '28px',
                            fontSize: '1rem'
                          }}
                          aria-label="Remove image"
                        >
                          ×
                        </button>
                      </div>
                      <p style={{
                        marginTop: '0.5rem',
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {imageData.file?.name || 'Cloudinary Image'}
                      </p>
                      {imageData.file?.size && (
                        <p style={{
                          fontSize: '0.75rem',
                          color: '#9ca3af',
                          textAlign: 'center'
                        }}>
                          {(imageData.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Product Variations Section */}
        <div className={styles.formSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 className={styles.formSectionTitle} style={{ margin: 0 }}>Product Variations & Customization System</h2>
              <p className={styles.formHelpText} style={{ margin: '0.25rem 0 0' }}>
                Add different sizes/variations or set up an advanced customizable system (e.g. Bindings, Colour Palettes).
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f1f5f9', padding: '0.5rem 1rem', borderRadius: '30px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Customizable Mode</span>
              <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={isCustomizable}
                  onChange={(e) => {
                    setIsCustomizable(e.target.checked);
                    if (e.target.checked && customizationOptions.length === 0) {
                      setCustomizationOptions([
                        { id: 'group_binding', title: 'Binding', type: 'image_selector', values: [] },
                        { id: 'group_color', title: 'Colour', type: 'colour_palette', values: [] }
                      ]);
                      setNewValueInputs({
                        'group_binding': { name: '', price: '', compareAtPrice: '', stock: '100', sku: '', hexCode: '#3b82f6', imageUrl: '', label: '', placeholder: '', charLimit: '100' },
                        'group_color': { name: '', price: '', compareAtPrice: '', stock: '100', sku: '', hexCode: '#3b82f6', imageUrl: '', label: '', placeholder: '', charLimit: '100' }
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
            /* Classic size variations list */
            <div className={styles.variationsSection}>
              {variations.length > 0 && (
                <div className={styles.variationsList}>
                  {variations.map((variation, index) => (
                    <div key={index} className={styles.variationItem}>
                      <div className={styles.variationInfo}>
                        <input
                          type="text"
                          value={variation.size}
                          onChange={(e) => handleUpdateVariation(index, 'size', e.target.value)}
                          placeholder="Size"
                          className={styles.variationInput}
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={variation.price}
                          onChange={(e) => handleUpdateVariation(index, 'price', e.target.value)}
                          placeholder="Price"
                          className={styles.variationInput}
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={variation.compareAtPrice || ''}
                          onChange={(e) => handleUpdateVariation(index, 'compareAtPrice', e.target.value)}
                          placeholder="Compare at"
                          className={styles.variationInput}
                        />
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={variation.weight || ''}
                          onChange={(e) => handleUpdateVariation(index, 'weight', e.target.value)}
                          placeholder="Weight (kg)"
                          className={styles.variationInput}
                        />
                        <span className={styles.variationSize}>{variation.size}</span>
                        <span className={styles.variationPrice}>
                          ₹{variation.price}
                          {variation.compareAtPrice?.trim()
                            ? ` (compare ₹${variation.compareAtPrice})`
                            : ''}
                          {variation.weight ? ` | ${variation.weight} kg` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveVariation(index)}
                        className={styles.removeVariationButton}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.variationInputs}>
                <div className={styles.variationInputGroup}>
                  <label className={styles.variationInputLabel}>Size</label>
                  <input
                    type="text"
                    value={newVariation.size}
                    onChange={(e) => setNewVariation({ ...newVariation, size: e.target.value })}
                    placeholder="e.g., 1L, 2L, 500ml"
                    className={styles.variationInput}
                  />
                </div>
                <div className={styles.variationInputGroup}>
                  <label className={styles.variationInputLabel}>Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newVariation.price}
                    onChange={(e) => setNewVariation({ ...newVariation, price: e.target.value })}
                    placeholder="e.g., 50, 95"
                    min="0"
                    className={styles.variationInput}
                  />
                </div>
                <div className={styles.variationInputGroup}>
                  <label className={styles.variationInputLabel}>Compare at (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newVariation.compareAtPrice || ''}
                    onChange={(e) => setNewVariation({ ...newVariation, compareAtPrice: e.target.value })}
                    placeholder="Optional"
                    min="0"
                    className={styles.variationInput}
                  />
                </div>
                <div className={styles.variationInputGroup}>
                  <label className={styles.variationInputLabel}>Weight (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={newVariation.weight || ''}
                    onChange={(e) => setNewVariation({ ...newVariation, weight: e.target.value })}
                    placeholder="e.g. 0.5"
                    min="0"
                    className={styles.variationInput}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddVariation}
                  className={styles.addVariationButton}
                >
                  + Add
                </button>
              </div>
            </div>
          ) : (
            /* Customization System Panel */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%', marginTop: '1rem' }}>
              
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
                      className={styles.formInput}
                      style={{ width: '100%' }}
                    />
                  </div>
                  
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                      Selector Type
                    </label>
                    <select
                      value={newGroupType}
                      onChange={(e) => setNewGroupType(e.target.value as any)}
                      style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', backgroundColor: 'white', height: '42px' }}
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
                      height: '42px'
                    }}
                  >
                    + Add Group
                  </button>
                </div>

                {/* Variation Groups list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {customizationOptions.map((group, groupIdx) => {
                    const groupInput = newValueInputs[group.id] || {
                      name: '', price: '', compareAtPrice: '', stock: '100', sku: '', hexCode: '#3b82f6', imageUrl: '', label: '', placeholder: '', charLimit: '100'
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
                                    handleUploadsFlagChange(group.id, 'polaroidUploadEnabled', e.target.checked);
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
                                      handleUploadsHintChange(group.id, 'polaroidUploadHint', e.target.value);
                                    }}
                                    placeholder="Upload photos for polaroids."
                                    className={styles.formInput}
                                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
                                  />
                                </div>
                              ) : null}
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(group.stripUploadEnabled)}
                                  onChange={(e) => {
                                    handleUploadsFlagChange(group.id, 'stripUploadEnabled', e.target.checked);
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
                                      handleUploadsHintChange(group.id, 'stripUploadHint', e.target.value);
                                    }}
                                    placeholder="Upload photos for strips."
                                    className={styles.formInput}
                                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
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
                                      handleUploadsHintChange(group.id, 'uploadHintBoth', e.target.value);
                                    }}
                                    placeholder="Upload photos for polaroids and strips."
                                    className={styles.formInput}
                                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
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
                                                    handleUploadsMaxImagesMapChange(group.id, updatedMap);
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
                                                    handleUploadsMaxImagesMapChange(group.id, updatedMap);
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
                                                  handleUploadsMaxImagesMapChange(group.id, updatedMap);
                                                }}
                                                style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem', width: '80px' }}
                                              />

                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const updatedMap = (group.maxImagesMap || []).filter((_, i) => i !== entryIdx);
                                                  handleUploadsMaxImagesMapChange(group.id, updatedMap);
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
                                              handleUploadsMaxImagesMapChange(group.id, updatedMap);
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
                                                        const imageUrl = await uploadCustomizationImage(file);
                                                        setEditingValueInput({ ...editingValueInput, imageUrl });
                                                      } catch {
                                                        setError('Failed to upload image file');
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
                                      className={styles.formInput}
                                      style={{ width: '100%', height: '36px', padding: '0.45rem' }}
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
                                      className={styles.formInput}
                                      style={{ width: '100%', height: '36px', padding: '0.45rem' }}
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
                                      className={styles.formInput}
                                      style={{ width: '100%', height: '36px', padding: '0.45rem' }}
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
                                    className={styles.formInput}
                                    style={{ width: '100%', height: '36px', padding: '0.45rem' }}
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
                                      style={{ width: '38px', height: '36px', padding: '0', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }}
                                    />
                                    <input
                                      type="text"
                                      value={groupInput.hexCode}
                                      onChange={(e) => setNewValueInputs({
                                        ...newValueInputs,
                                        [group.id]: { ...groupInput, hexCode: e.target.value }
                                      })}
                                      className={styles.formInput}
                                      style={{ width: '70px', height: '36px', padding: '0.45rem' }}
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
                                  className={styles.formInput}
                                  style={{ width: '100%', height: '36px', padding: '0.45rem' }}
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
                                  cursor: 'pointer',
                                  height: '36px'
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
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                            width: '100%'
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
                              title="Upload Custom Photo for this combination"
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
                                className={styles.formInput}
                                style={{ width: '100%', height: '32px', padding: '0.25rem 0.5rem' }}
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
                                className={styles.formInput}
                                style={{ width: '100%', height: '32px', padding: '0.25rem 0.5rem' }}
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
                                className={styles.formInput}
                                style={{ width: '100%', height: '32px', padding: '0.25rem 0.5rem' }}
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
                                className={styles.formInput}
                                style={{ width: '100%', height: '32px', padding: '0.25rem 0.5rem' }}
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
                              title="Remove override"
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

            </div>
          )}
        </div>

        {/* Size Guide Section */}
        <div className={styles.formSection}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 className={styles.formSectionTitle} style={{ margin: 0 }}>Size Guide</h2>
              <p className={styles.formHelpText} style={{ marginTop: '0.25rem' }}>
                Enable a size guide button for this product in the store modal.
              </p>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' }}>
              <input
                type="checkbox"
                checked={sizeGuide.enabled}
                onChange={(e) => setSizeGuide((prev) => ({ ...prev, enabled: e.target.checked }))}
                style={{ width: '18px', height: '18px', accentColor: '#800020' }}
              />
              Enable Size Guide?
            </label>
          </div>

          {sizeGuide.enabled && (
            <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: '#fdfbfb', border: '1px solid #f0e6e8', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Type Switcher */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel} style={{ fontWeight: 600 }}>Size Guide Format</label>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: sizeGuide.type === 'table' ? 600 : 400 }}>
                    <input
                      type="radio"
                      name="sizeGuideType"
                      value="table"
                      checked={sizeGuide.type === 'table'}
                      onChange={() => setSizeGuide((prev) => ({ ...prev, type: 'table' }))}
                      style={{ accentColor: '#800020' }}
                    />
                    Table Format (Size, Bust, Waist, Hip)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: sizeGuide.type === 'image' ? 600 : 400 }}>
                    <input
                      type="radio"
                      name="sizeGuideType"
                      value="image"
                      checked={sizeGuide.type === 'image'}
                      onChange={() => setSizeGuide((prev) => ({ ...prev, type: 'image' }))}
                      style={{ accentColor: '#800020' }}
                    />
                    Upload Image
                  </label>
                </div>
              </div>

              {/* Table Option */}
              {sizeGuide.type === 'table' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#ffffff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: '#334155' }}>Size</th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: '#334155' }}>Bust</th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: '#334155' }}>Waist</th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: '#334155' }}>Hip</th>
                          <th style={{ padding: '10px 14px', width: '80px', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sizeGuide.tableRows || []).map((row, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <input
                                type="text"
                                value={row.size}
                                onChange={(e) => handleUpdateSizeGuideRow(index, 'size', e.target.value)}
                                placeholder="e.g. S / M / 32"
                                className={styles.formInput}
                                style={{ padding: '6px 10px', fontSize: '0.85rem', fontWeight: 600 }}
                              />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input
                                type="text"
                                value={row.bust}
                                onChange={(e) => handleUpdateSizeGuideRow(index, 'bust', e.target.value)}
                                placeholder='e.g. 34"'
                                className={styles.formInput}
                                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                              />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input
                                type="text"
                                value={row.waist}
                                onChange={(e) => handleUpdateSizeGuideRow(index, 'waist', e.target.value)}
                                placeholder='e.g. 27"'
                                className={styles.formInput}
                                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                              />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input
                                type="text"
                                value={row.hip}
                                onChange={(e) => handleUpdateSizeGuideRow(index, 'hip', e.target.value)}
                                placeholder='e.g. 37"'
                                className={styles.formInput}
                                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                              />
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveSizeGuideRow(index)}
                                style={{
                                  background: '#fee2e2',
                                  color: '#ef4444',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '5px 8px',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                }}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleAddSizeGuideRow}
                      className={styles.addVariationButton}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                    >
                      + Add Size Row
                    </button>
                    <button
                      type="button"
                      onClick={handleResetSizeGuideRows}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '0.5rem 1rem',
                        fontSize: '0.85rem',
                        color: '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      Reset to Standard (XS–XXL)
                    </button>
                  </div>
                </div>
              )}

              {/* Image Option */}
              {sizeGuide.type === 'image' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(sizeGuideImagePreview || sizeGuide.imageUrl) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '360px' }}>
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: '#fafafa', padding: '8px' }}>
                        <img
                          src={sizeGuideImagePreview || sizeGuide.imageUrl}
                          alt="Size guide preview"
                          style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '8px' }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSizeGuideImageFile(null);
                          setSizeGuideImagePreview('');
                          setSizeGuide((prev) => ({ ...prev, imageUrl: '' }));
                        }}
                        style={{
                          alignSelf: 'flex-start',
                          background: '#fee2e2',
                          color: '#dc2626',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        Remove Image
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <label
                        className={styles.addButton}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          cursor: 'pointer',
                          padding: '0.65rem 1.25rem',
                          fontWeight: 600,
                        }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setSizeGuideImageFile(file);
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setSizeGuideImagePreview(reader.result as string);
                                setSizeGuide((prev) => ({ ...prev, imageUrl: reader.result as string }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          style={{ display: 'none' }}
                        />
                        <span>📤</span> Upload Size Chart Image
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMediaPickerTarget('size-guide');
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
                        <span>🖼️</span> Select from Media Library
                      </button>
                    </div>
                  )}
                </div>
              )}

              <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>
                💡 Note: The &quot;How to Measure&quot; reference section will automatically appear beneath this size chart on the customer product view.
              </p>
            </div>
          )}
        </div>

        {/* Folding Titles / Accordion Description Sections */}
        <div className={styles.formSection}>
          <h2 className={styles.formSectionTitle}>Folding Titles / Description Sections (Accordion)</h2>
          <p className={styles.formHelpText} style={{ marginBottom: '1.5rem' }}>
            Add expandable folding sections below the main description (e.g., Size, Paper Quality, What&apos;s Inside?).
          </p>

          {accordionItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
              {accordionItems.map((item, index) => (
                <div
                  key={index}
                  style={{
                    padding: '1.25rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => handleUpdateAccordionItem(index, 'title', e.target.value)}
                      placeholder="Title"
                      className={styles.formInput}
                      style={{ fontWeight: 600, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveAccordionItem(index)}
                      className={styles.cancelButton}
                      style={{ padding: '0.4rem 0.8rem', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                  <div>
                    <label className={styles.formHelpText} style={{ display: 'block', marginBottom: '0.25rem' }}>Description Content</label>
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

          <div
            style={{
              padding: '1.25rem',
              background: '#fff',
              border: '2px dashed #cbd5e1',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div className={styles.formGroup}>
              <label className={styles.formLabel} style={{ fontSize: '0.9rem' }}>New Folding Section Title</label>
              <input
                type="text"
                value={newAccordionTitle}
                onChange={(e) => setNewAccordionTitle(e.target.value)}
                placeholder="e.g. Whats inside? or Size & Details"
                className={styles.formInput}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} style={{ fontSize: '0.9rem' }}>New Folding Section Content (HTML Editor)</label>
              <RichTextEditor
                value={newAccordionHtmlContent}
                onChange={setNewAccordionHtmlContent}
                placeholder="Enter HTML content..."
              />
            </div>
            <button
              type="button"
              onClick={handleAddAccordionItem}
              className={styles.addVariationButton}
              style={{ width: 'fit-content', padding: '0.6rem 1.2rem', marginTop: '0.5rem' }}
            >
              + Add Accordion Section
            </button>
          </div>
        </div>

        {/* Status Section */}
        <div className={styles.formSection}>
          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className={styles.checkbox}
            />
            <label htmlFor="isActive" className={styles.checkboxLabel}>
              Active (visible to customers)
            </label>
          </div>
          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="buyNowEnabled"
              checked={buyNowEnabled}
              onChange={(e) => setBuyNowEnabled(e.target.checked)}
              className={styles.checkbox}
            />
            <label htmlFor="buyNowEnabled" className={styles.checkboxLabel} style={{ cursor: 'pointer' }}>
              Enable buy now button
            </label>
          </div>
          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="buyAgainEnabled"
              checked={buyAgainEnabled}
              onChange={(e) => setBuyAgainEnabled(e.target.checked)}
              className={styles.checkbox}
            />
            <label htmlFor="buyAgainEnabled" className={styles.checkboxLabel} style={{ cursor: 'pointer' }}>
              Show buy again
            </label>
          </div>
          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="hoverNextImage"
              checked={hoverNextImage}
              onChange={(e) => setHoverNextImage(e.target.checked)}
              className={styles.checkbox}
            />
            <label htmlFor="hoverNextImage" className={styles.checkboxLabel} style={{ cursor: 'pointer' }}>
              Next image on hover
            </label>
          </div>
        </div>

        {/* Form Actions */}
        <div className={styles.formActions}>
          <button
            type="submit"
            disabled={loading}
            className={styles.submitButton}
          >
            {loading ? (
              <>
                <LoadingSpinner size="small" />
                Creating...
              </>
            ) : (
              'Create Product'
            )}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className={styles.cancelButton}
          >
            Cancel
          </button>
        </div>
      </form>

      <MediaLibraryModal
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleMediaLibrarySelect}
        multiple={true}
        title="Select Product Images from Cloudinary"
      />
    </div>
  );
}
