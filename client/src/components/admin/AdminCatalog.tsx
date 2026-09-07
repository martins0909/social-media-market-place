import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Plus, Package, Image as ImageIcon, Database, Hash, Edit2, ChevronDown, RefreshCw } from "lucide-react";
import Papa from "papaparse";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { catalogAPI, catalogCategoriesAPI } from "@/lib/api";

interface SerialNumber {
  id: string;
  serial: string;
  isUsed: boolean;
  usedBy?: string; // user email
  usedAt?: string;
}

interface CatalogCategory {
  id: string;
  name: string;
  icon?: string;
  createdAt: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  category: string; // category NAME stored to align with Shop filters
  description: string;
  price: number;
  image: string;
  serialNumbers?: SerialNumber[]; // Array of serial numbers
  createdAt?: string; // Made optional to match API response
}

const PRODUCTS_KEY = "catalog_products"; // used only for one-time migration

export default function AdminCatalog() {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Category form state
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("");
  const [uploadingCatIcon, setUploadingCatIcon] = useState(false);
  const [editCatDialogOpen, setEditCatDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CatalogCategory | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatIcon, setEditCatIcon] = useState("");
  const [uploadingEditCatIcon, setUploadingEditCatIcon] = useState(false);

  // Product form state
  const [pName, setPName] = useState("");
  const [pCategory, setPCategory] = useState<string>("");
  const [pDescription, setPDescription] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pImage, setPImage] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Serial number management
  const [serialDialogOpen, setSerialDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [newSerial, setNewSerial] = useState("");
  const [showImportBanner, setShowImportBanner] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Edit product state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editingInProgress, setEditingInProgress] = useState(false);

  // Derived lookup
  const categoryMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c.name])), [categories]);

  // Group products by category
  const groupedProducts = useMemo(() => {
    return products.reduce((acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = [];
      }
      acc[product.category].push(product);
      return acc;
    }, {} as Record<string, CatalogProduct[]>);
  }, [products]);

  // Get categories that have products
  const categoriesWithProducts = useMemo(() => {
    return categories.filter(cat => groupedProducts[cat.name]?.length > 0);
  }, [categories, groupedProducts]);

  // Function to toggle category expansion
  const toggleCategoryExpansion = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Function to get products to display for a category (0 or all)
  const getProductsToDisplay = (category: string) => {
    const products = groupedProducts[category] || [];
    const isExpanded = expandedCategories[category];
    return isExpanded ? products : [];
  };

  // Fetch products from MongoDB on mount and poll for updates
  useEffect(() => {
    loadProducts();
    loadCategories();
    
    // Auto-refresh every 30 seconds to show updated serial states after purchases
    const interval = setInterval(() => {
      loadProducts();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await catalogAPI.getAll({ admin: true });
      setProducts(data);
      
      // If DB is empty but there are local products, offer import
      try {
        const localRaw = localStorage.getItem(PRODUCTS_KEY);
        const localList: CatalogProduct[] = localRaw ? JSON.parse(localRaw) : [];
        if (Array.isArray(localList) && localList.length > 0 && (!data || data.length === 0)) {
          setImportCount(localList.length);
          setShowImportBanner(true);
        } else {
          setShowImportBanner(false);
          setImportCount(0);
        }
      } catch {
        // ignore
      }
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Failed to load products from database");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    toast.success("Products refreshed");
  };

  const importLocalProducts = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        toast.error("Please login as admin to import");
        return;
      }
      const localRaw = localStorage.getItem(PRODUCTS_KEY);
      const localList: CatalogProduct[] = localRaw ? JSON.parse(localRaw) : [];
      if (!Array.isArray(localList) || localList.length === 0) {
        toast.info("No local products found");
        return;
      }
      // Create each product then update serial numbers if present
      for (const p of localList) {
        const payload = {
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          image: p.image,
          category: p.category,
          serialNumbers: [] as SerialNumber[],
        };
        const created = await catalogAPI.create(payload as unknown as Omit<CatalogProduct, 'createdAt'>);
        if (p.serialNumbers && p.serialNumbers.length > 0) {
          await catalogAPI.update(created.id, { serialNumbers: p.serialNumbers });
        }
      }
      toast.success(`Imported ${localList.length} products to database`);
      setShowImportBanner(false);
      await loadProducts();
    } catch (e) {
      console.error("Import failed", e);
      toast.error("Failed to import local products");
    }
  };

  const loadCategories = async () => {
    try {
      const list = await catalogCategoriesAPI.getAll();
      if (list.length > 0) {
        setCategories(list.map(c => ({ id: c.id, name: c.name, icon: c.icon, createdAt: c.createdAt || new Date().toISOString() })));
      }
    } catch (e) {
      // fall back silently; defaults remain
      console.error("Error loading categories", e);
    }
  };

  const handleCategoryIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error("Please upload an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image size should be less than 2MB"); return; }

    setUploadingCatIcon(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setNewCategoryIcon(event.target?.result as string);
      setUploadingCatIcon(false);
      toast.success("Icon uploaded");
    };
    reader.readAsDataURL(file);
  };

  const handleEditCategoryIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error("Please upload an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image size should be less than 2MB"); return; }

    setUploadingEditCatIcon(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setEditCatIcon(event.target?.result as string);
      setUploadingEditCatIcon(false);
      toast.success("Icon uploaded");
    };
    reader.readAsDataURL(file);
  };

  const openEditCategory = (cat: CatalogCategory) => {
    setEditingCategory(cat);
    setEditCatName(cat.name);
    setEditCatIcon(cat.icon || "");
    setEditCatDialogOpen(true);
  };

  const updateCategory = async () => {
    if (!editingCategory) return;
    const name = editCatName.trim();
    if (!name) { toast.error("Category name required"); return; }
    
    try {
      const updated = await catalogCategoriesAPI.update(editingCategory.id, { name, icon: editCatIcon });
      setCategories(prev => prev.map(c => c.id === editingCategory.id ? { ...c, name: updated.name, icon: updated.icon } : c));
      setEditCatDialogOpen(false);
      setEditingCategory(null);
      toast.success("Category updated");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update category");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size should be less than 2MB");
      return;
    }

    setUploadingImage(true);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      setPImage(base64String);
      setUploadingImage(false);
      toast.success("Image uploaded successfully");
    };

    reader.onerror = () => {
      toast.error("Failed to upload image");
      setUploadingImage(false);
    };

    reader.readAsDataURL(file);
  };

  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) { toast.error("Category name required"); return; }
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) { toast.error("Category already exists"); return; }
    try {
      const created = await catalogCategoriesAPI.create(name, newCategoryIcon);
      const cat: CatalogCategory = { id: created.id, name: created.name, icon: created.icon, createdAt: created.createdAt || new Date().toISOString() };
      setCategories(prev => [...prev, cat]);
      setNewCategoryName("");
      setNewCategoryIcon("");
      toast.success("Category added");
    } catch (e) {
      console.error(e);
      toast.error("Failed to add category. Please check your connection.");
    }
  };

  const removeCategory = async (id: string) => {
    // also remove products in that category (by name)
    const name = categoryMap[id];
    const productsToDelete = products.filter(p => p.category === name);
    
    try {
      await catalogCategoriesAPI.delete(id);
      // Delete products from MongoDB
      for (const product of productsToDelete) {
        await catalogAPI.delete(product.id);
      }
      
      setProducts(prev => prev.filter(p => p.category !== name));
      setCategories(prev => prev.filter(c => c.id !== id));
      toast.info("Category removed");
    } catch (error) {
      console.error("Error removing category:", error);
      toast.error("Failed to remove category. Please check your connection.");
    }
  };

  const addProduct = async () => {
    if (!pName.trim() || !pDescription.trim()) { toast.error("Name & description required"); return; }
    if (!pCategory) { toast.error("Select a category"); return; }
    const price = parseFloat(pPrice);
    if (isNaN(price) || price <= 0) { toast.error("Enter valid price"); return; }
    if (!pImage.trim()) { toast.error("Please upload an image"); return; }

    const prod = {
      id: crypto.randomUUID(),
      name: pName.trim(),
      category: categoryMap[pCategory] || "",
      description: pDescription.trim(),
      price,
      image: pImage.trim(),
      serialNumbers: [],
    };
    
    try {
      const created = await catalogAPI.create(prod);
      setProducts(prev => [...prev, created]);
      setPName(""); setPCategory(""); setPDescription(""); setPPrice(""); setPImage("");
      toast.success("Product added and saved");
    } catch (error) {
      console.error("Error adding product:", error);
      toast.error("Failed to add product. Please check your connection.");
    }
  };

  const removeProduct = async (id: string) => {
    try {
      await catalogAPI.delete(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      toast.info("Product removed");
    } catch (error) {
      console.error("Error removing product:", error);
      toast.error("Failed to remove product. Please check your connection.");
    }
  };

  const openSerialDialog = (product: CatalogProduct) => {
    setSelectedProduct(product);
    setSerialDialogOpen(true);
  };

  const addSerialNumber = async () => {
    if (!selectedProduct || !newSerial.trim()) {
      toast.error("Serial number required");
      return;
    }

    // Check if admin is logged in
    const token = localStorage.getItem('admin_token');
    if (!token) {
      toast.error("Admin session expired. Please login again.");
      return;
    }

    const serial: SerialNumber = {
      id: crypto.randomUUID(),
      serial: newSerial.trim(),
      isUsed: false,
    };

    const updatedSerials = [...(selectedProduct.serialNumbers || []), serial];
    
    try {
      await catalogAPI.update(selectedProduct.id, { serialNumbers: updatedSerials });
      
      setProducts(prev => prev.map(p => {
        if (p.id === selectedProduct.id) {
          return {
            ...p,
            serialNumbers: updatedSerials
          };
        }
        return p;
      }));

      setSelectedProduct(prev => prev ? { ...prev, serialNumbers: updatedSerials } : null);
      setNewSerial("");
      toast.success("Serial number added");
    } catch (error) {
      console.error("Error adding serial number:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to add serial number: ${errorMsg}`);
    }
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!selectedProduct) {
      toast.error("No product selected");
      return;
    }

    // Check if admin is logged in
    const token = localStorage.getItem('admin_token');
    if (!token) {
      toast.error("Admin session expired. Please login again.");
      return;
    }

    // Check file type
    if (!file.name.endsWith('.csv')) {
      toast.error("Please upload a CSV file");
      return;
    }

    setUploadingCSV(true);
    
    // Parse using PapaParse to handle quoted multi-line content correctly
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          if (results.errors.length) {
            console.warn("CSV parsing errors:", results.errors);
          }
          
          const rows = results.data as string[][];
          const newSerials: SerialNumber[] = [];
          
          for (const row of rows) {
            // Join columns if multiple exist
            const serialContent = row.filter(cell => cell && typeof cell === 'string' && cell.trim()).join(", ").trim();
           
            if (serialContent) {
              newSerials.push({
                id: crypto.randomUUID(),
                serial: serialContent,
                isUsed: false,
              });
            }
          }

          if (newSerials.length === 0) {
            toast.info("No serial numbers to add");
            setUploadingCSV(false);
            return;
          }

          const updatedSerials = [...(selectedProduct.serialNumbers || []), ...newSerials];
          
          await catalogAPI.update(selectedProduct.id, { serialNumbers: updatedSerials });
          
          setProducts(prev => prev.map(p => {
            if (p.id === selectedProduct.id) {
              return {
                ...p,
                serialNumbers: updatedSerials
              };
            }
            return p;
          }));

          setSelectedProduct(prev => prev ? { ...prev, serialNumbers: updatedSerials } : null);
          toast.success(`${newSerials.length} serial numbers added from CSV`);
          
          // Reset file input
          e.target.value = '';
        } catch (error) {
          console.error("Error saving serials:", error);
          const errorMsg = error instanceof Error ? error.message : String(error);
          toast.error(`Failed to save serial numbers: ${errorMsg}`);
        } finally {
          setUploadingCSV(false);
        }
      },
      error: (error) => {
        console.error("CSV parse error:", error);
        toast.error(`Failed to parse CSV: ${error.message}`);
        setUploadingCSV(false);
      }
    });
  };

  const removeSerialNumber = async (productId: string, serialId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const updatedSerials = (product.serialNumbers || []).filter(s => s.id !== serialId);
    
    try {
      await catalogAPI.update(productId, { serialNumbers: updatedSerials });
      
      setProducts(prev => prev.map(p => {
        if (p.id === productId) {
          return {
            ...p,
            serialNumbers: updatedSerials
          };
        }
        return p;
      }));
      
      if (selectedProduct?.id === productId) {
        setSelectedProduct(prev => prev ? { ...prev, serialNumbers: updatedSerials } : null);
      }
      
      toast.info("Serial number removed");
    } catch (error) {
      console.error("Error removing serial number:", error);
      toast.error("Failed to remove serial number. Please check your connection.");
    }
  };

  const deleteAllSerialNumbers = async () => {
    if (!selectedProduct) return;

    if (!window.confirm("Are you sure you want to delete ALL serial numbers for this product? This action cannot be undone.")) {
      return;
    }

    // Check if admin is logged in
    const token = localStorage.getItem('admin_token');
    if (!token) {
      toast.error("Admin session expired. Please login again.");
      return;
    }

    try {
      await catalogAPI.update(selectedProduct.id, { serialNumbers: [] });
      
      setProducts(prev => prev.map(p => {
        if (p.id === selectedProduct.id) {
          return {
            ...p,
            serialNumbers: []
          };
        }
        return p;
      }));

      setSelectedProduct(prev => prev ? { ...prev, serialNumbers: [] } : null);
      toast.success("All serial numbers deleted");
    } catch (error) {
      console.error("Error deleting all serial numbers:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to delete serial numbers: ${errorMsg}`);
    }
  };

  const toggleSerialUsed = async (productId: string, serialId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const updatedSerials = (product.serialNumbers || []).map(s => {
      if (s.id === serialId) {
        return { ...s, isUsed: !s.isUsed, usedBy: s.isUsed ? undefined : "Manual", usedAt: s.isUsed ? undefined : new Date().toISOString() };
      }
      return s;
    });
    
    try {
      await catalogAPI.update(productId, { serialNumbers: updatedSerials });
      
      setProducts(prev => prev.map(p => {
        if (p.id === productId) {
          return {
            ...p,
            serialNumbers: updatedSerials
          };
        }
        return p;
      }));
      
      if (selectedProduct?.id === productId) {
        setSelectedProduct(prev => prev ? { ...prev, serialNumbers: updatedSerials } : null);
      }
      
      toast.success("Status updated");
    } catch (error) {
      console.error("Error updating serial status:", error);
      toast.error("Failed to update status. Please check your connection.");
    }
  };

  const openEditDialog = (product: CatalogProduct) => {
    setEditingProduct(product);
    setEditPrice(product.price.toString());
    setEditDescription(product.description);
    setEditDialogOpen(true);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    
    const price = parseFloat(editPrice);
    if (isNaN(price) || price <= 0) {
      toast.error("Enter valid price");
      return;
    }
    
    if (!editDescription.trim()) {
      toast.error("Description required");
      return;
    }

    setEditingInProgress(true);
    
    try {
      await catalogAPI.update(editingProduct.id, {
        price,
        description: editDescription.trim()
      });
      
      setProducts(prev => prev.map(p => {
        if (p.id === editingProduct.id) {
          return {
            ...p,
            price,
            description: editDescription.trim()
          };
        }
        return p;
      }));
      
      toast.success("Product updated successfully");
      setEditDialogOpen(false);
      setEditingProduct(null);
      setEditPrice("");
      setEditDescription("");
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Failed to update product. Please check your connection.");
    } finally {
      setEditingInProgress(false);
    }
  };

  return (
    <div className="space-y-10">
      <section>
        <Card className="bg-white/90 backdrop-blur border-2 border-white/60 shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#1565C0] flex items-center justify-center"><Database className="h-6 w-6 text-white" /></div>
                <div>
                  <CardTitle className="text-2xl bg-clip-text text-transparent bg-gradient-to-r from-[#0d4f9f] to-[#0a3d7c]">Catalog Manager</CardTitle>
                  <CardDescription>Manage categories and products stored locally</CardDescription>
                </div>
              </div>
              <Button
                onClick={handleManualRefresh}
                disabled={refreshing || loading}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Categories */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold flex items-center gap-2"><Package className="h-5 w-5 text-[#1565C0]" /> Categories</h3>
              <div className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <Input placeholder="New category name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="h-11" />
                  <div className="flex items-center gap-2">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleCategoryIconUpload}
                      disabled={uploadingCatIcon}
                      className="text-xs"
                    />
                    {newCategoryIcon && (
                      <div className="relative w-10 h-10 rounded border overflow-hidden flex-shrink-0">
                        <img src={newCategoryIcon} alt="Icon" className="w-full h-full object-contain" />
                        <button onClick={() => setNewCategoryIcon("")} className="absolute inset-0 bg-black/50 text-white opacity-0 hover:opacity-100 flex items-center justify-center"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    )}
                  </div>
                </div>
                <Button onClick={addCategory} disabled={uploadingCatIcon} className="bg-gradient-to-r from-[#1565C0] to-[#1565C0] hover:from-[#0d4f9f] hover:to-[#0d4f9f] text-white h-11 px-6">Add</Button>
              </div>
              {categories.length === 0 && <p className="text-sm text-gray-500">No categories yet.</p>}
              <div className="flex flex-wrap gap-3">
                {categories.map(cat => (
                  <div key={cat.id} className="group relative">
                    <Badge className="px-4 py-2 bg-gradient-to-r from-[#1565C0] to-[#1565C0] text-white shadow cursor-default flex items-center gap-2">
                      {cat.icon && <img src={cat.icon} alt="" className="w-4 h-4 object-contain bg-white rounded-sm" />}
                      {cat.name}
                      <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditCategory(cat)}
                          className="text-white/80 hover:text-white"
                          aria-label="Edit category"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeCategory(cat.id)}
                          className="text-white/80 hover:text-white"
                          aria-label="Remove category"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Import Banner (one-time migration) */}
            {showImportBanner && (
              <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between">
                <div>
                  Found {importCount} product{importCount === 1 ? '' : 's'} saved on this device. Import them to the database so they sync across all devices.
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-100" onClick={() => setShowImportBanner(false)}>Dismiss</Button>
                  <Button className="bg-amber-600 hover:bg-amber-700" onClick={importLocalProducts}>Import now</Button>
                </div>
              </div>
            )}

            {/* Products */}
            <div className="space-y-6">
              <h3 className="text-xl font-semibold flex items-center gap-2"><ImageIcon className="h-5 w-5 text-[#1565C0]" /> Add Product</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <Input placeholder="Name" value={pName} onChange={e => setPName(e.target.value)} />
                <select value={pCategory} onChange={e => setPCategory(e.target.value)} className="border rounded-md px-3 py-2 bg-white/70 backdrop-blur focus:outline-none focus:ring-2 focus:ring-[#1565C0] dark:bg-[#09090b] dark:border-gray-700 dark:text-gray-100">
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Input placeholder="Price" type="number" min="0" step="0.01" value={pPrice} onChange={e => setPPrice(e.target.value)} />
                <div className="relative">
                  <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="cursor-pointer"
                  />
                  {uploadingImage && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-black/80 rounded-md">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Uploading...</span>
                    </div>
                  )}
                </div>
                {pImage && (
                  <div className="md:col-span-2">
                    <div className="relative w-full h-48 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                      <img src={pImage} alt="Preview" className="w-full h-full object-contain bg-gray-50 dark:bg-[#09090b]" />
                      <button
                        onClick={() => setPImage("")}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg transition-colors"
                        aria-label="Remove image"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
                <div className="md:col-span-2">
                  <Textarea placeholder="Description" value={pDescription} onChange={e => setPDescription(e.target.value)} className="min-h-[100px]" />
                </div>
              </div>
              <Button onClick={addProduct} disabled={uploadingImage} className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow px-8">
                <Plus className="h-4 w-4 mr-2" /> Save Product
              </Button>
            </div>

            {/* Product List */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold flex items-center gap-2"><Package className="h-5 w-5 text-[#1565C0]" /> Products ({products.length})</h3>
              {products.length === 0 && <p className="text-sm text-gray-500">No products yet.</p>}
              
              {/* Display products grouped by category */}
              <div className="space-y-8">
                {categoriesWithProducts.map((category) => {
                  const categoryProducts = groupedProducts[category.name] || [];
                  const displayedProducts = getProductsToDisplay(category.name);
                  const isExpanded = expandedCategories[category.name];

                  return (
                    <div key={category.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#1565C0] dark:from-[#4d9cff] dark:to-[#4d9cff] border-b-2 border-gray-200 dark:border-gray-800 pb-2 flex-1">
                          {category.name} ({categoryProducts.length})
                        </h4>
                        <Button
                          variant="ghost"
                          onClick={() => toggleCategoryExpansion(category.name)}
                          className="flex items-center gap-2 text-[#1565C0] hover:text-[#0d4f9f] dark:text-[#4d9cff] dark:hover:text-[#8fb5e8] font-semibold"
                        >
                          <span className="text-sm">{isExpanded ? 'Collapse' : 'Expand'}</span>
                          <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                        </Button>
                      </div>
                      
                      {isExpanded && (
                      <div className="space-y-3">
                        {displayedProducts.map(prod => {
                  const availableSerials = (prod.serialNumbers || []).filter(s => !s.isUsed).length;
                  const usedSerials = (prod.serialNumbers || []).filter(s => s.isUsed).length;
                  
                  return (
                  <Card key={prod.id} className="bg-white/90 dark:bg-black/90 backdrop-blur-xl shadow-lg border-2 border-white/60 dark:border-gray-800 hover:shadow-xl transition-all duration-300">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        {/* Category Badge */}
                        <Badge variant="outline" className="px-2 py-0.5 text-xs tracking-wide bg-gradient-to-r from-[#d5e5ff] to-[#d5e5ff] dark:from-[#0B0F14] dark:to-[#0B0F14] text-[#0d4f9f] dark:text-[#4d9cff] border-none flex-shrink-0">
                          {prod.category}
                        </Badge>
                        
                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-base mb-0.5 bg-clip-text text-transparent bg-gradient-to-r from-[#0d4f9f] to-[#0d4f9f] dark:from-[#4d9cff] dark:to-[#4d9cff] truncate">{prod.name}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{prod.description}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-xs px-2 py-0.5 bg-[#e8f1ff] text-[#0d4f9f] border-[#b0cdf5] dark:bg-[#0B0F14] dark:text-[#4d9cff] dark:border-[#0a3d7c]">
                              <Hash className="h-3 w-3 mr-1" />
                              {availableSerials} Available
                            </Badge>
                            {usedSerials > 0 && (
                              <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gray-50 text-gray-700 border-gray-200 dark:bg-[#09090b] dark:text-gray-400 dark:border-gray-700">
                                {usedSerials} Used
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Price and Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className="text-base px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 font-bold">
                            ₦{prod.price.toFixed(2)}
                          </Badge>
                          <button
                            onClick={() => openEditDialog(prod)}
                            className="bg-[#e8f1ff] dark:bg-[#0B0F14] rounded-lg p-2 hover:bg-[#d5e5ff] dark:hover:bg-[#0B0F14] text-[#1565C0] dark:text-[#4d9cff] transition-colors"
                            aria-label="Edit product"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openSerialDialog(prod)}
                            className="bg-[#e8f1ff] dark:bg-[#0B0F14] rounded-lg p-2 hover:bg-[#d5e5ff] dark:hover:bg-[#0B0F14] text-[#1565C0] dark:text-[#4d9cff] transition-colors"
                            aria-label="Manage serial numbers"
                          >
                            <Hash className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => removeProduct(prod.id)}
                            className="bg-red-50 dark:bg-red-950 rounded-lg p-2 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 transition-colors"
                            aria-label="Remove product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
                      </div>
                      )}
                    </div>
                  );
                })}
              </div>
          </div>
          </CardContent>
          <CardFooter className="text-xs text-gray-500">
            Products and serial numbers are stored securely in the database and sync across devices.
          </CardFooter>
        </Card>
      </section>

      {/* Serial Number Management Dialog */}
      <Dialog open={serialDialogOpen} onOpenChange={setSerialDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Manage Serial Numbers - {selectedProduct?.name}
            </DialogTitle>
            <DialogDescription>
              Add serial numbers that will be assigned to customers after purchase. Each unit sold will receive one unique serial number.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add Serial Form */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter serial number"
                  value={newSerial}
                  onChange={(e) => setNewSerial(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSerialNumber()}
                  className="font-mono"
                />
                <Button onClick={addSerialNumber} className="bg-[#1565C0] hover:bg-[#0d4f9f]">
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>

              {/* CSV Upload */}
              <div className="flex items-center gap-2 p-3 bg-[#e8f1ff] dark:bg-[#0B0F14]/30 rounded-lg border-2 border-[#b0cdf5] dark:border-[#0a3d7c]">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#0B0F14] dark:text-[#8fb5e8]">Bulk Upload</p>
                  <p className="text-xs text-[#0d4f9f] dark:text-[#4d9cff]">Upload a CSV file with one serial number per line</p>
                </div>
                <label htmlFor="csv-upload" className={`cursor-pointer ${uploadingCSV ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    disabled={uploadingCSV}
                    className="hidden"
                  />
                  <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-[#1565C0] text-white hover:bg-[#0d4f9f] h-10 px-4 py-2">
                    <Database className="h-4 w-4 mr-2" />
                    {uploadingCSV ? "Uploading..." : "Upload CSV"}
                  </div>
                </label>
              </div>
            </div>

            {/* Serial Numbers List */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-sm">
                  Serial Numbers ({selectedProduct?.serialNumbers?.length || 0})
                </h4>
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline" className="bg-[#e8f1ff] text-[#0d4f9f] border-[#b0cdf5]">
                    {selectedProduct?.serialNumbers?.filter(s => !s.isUsed).length || 0} Available
                  </Badge>
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                    {selectedProduct?.serialNumbers?.filter(s => s.isUsed).length || 0} Used
                  </Badge>
                  {(selectedProduct?.serialNumbers?.length || 0) > 0 && (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={deleteAllSerialNumbers}
                      className="h-6 px-2 text-xs"
                    >
                      Delete All
                    </Button>
                  )}
                </div>
              </div>

              {(!selectedProduct?.serialNumbers || selectedProduct.serialNumbers.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">No serial numbers yet. Add some above.</p>
              )}

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedProduct?.serialNumbers?.map(serial => (
                  <div
                    key={serial.id}
                    className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                      serial.isUsed
                        ? "bg-gray-50 dark:bg-[#09090b] border-gray-200 dark:border-gray-700"
                        : "bg-[#e8f1ff] dark:bg-[#0B0F14]/30 border-[#b0cdf5] dark:border-[#0a3d7c]"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-semibold text-sm break-all whitespace-pre-wrap leading-relaxed">{serial.serial}</p>
                      {serial.isUsed && serial.usedBy && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Used by: {serial.usedBy} {serial.usedAt && `on ${new Date(serial.usedAt).toLocaleDateString()}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {serial.isUsed ? (
                        <Badge className="bg-gray-500">Used</Badge>
                      ) : (
                        <Badge className="bg-[#1565C0]">Available</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => selectedProduct && toggleSerialUsed(selectedProduct.id, serial.id)}
                        className="text-orange-600 hover:text-orange-700"
                      >
                        {serial.isUsed ? "Mark Available" : "Mark Used"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => selectedProduct && removeSerialNumber(selectedProduct.id, serial.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSerialDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={editCatDialogOpen} onOpenChange={setEditCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Update category name and icon</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input value={editCatName} onChange={e => setEditCatName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Icon</label>
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 border rounded-lg overflow-hidden bg-gray-50 dark:bg-[#09090b] flex items-center justify-center">
                  {editCatIcon ? (
                    <img src={editCatIcon} alt="Icon" className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleEditCategoryIconUpload}
                    disabled={uploadingEditCatIcon}
                  />
                  {editCatIcon && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setEditCatIcon("")}
                      className="mt-2 text-red-600 hover:text-red-700 h-auto p-0"
                    >
                      Remove Icon
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCatDialogOpen(false)}>Cancel</Button>
            <Button onClick={updateCategory} disabled={uploadingEditCatIcon}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-[#1565C0]" />
              Edit Product - {editingProduct?.name}
            </DialogTitle>
            <DialogDescription>
              Update the price and description for this product.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Price (₦)</label>
              <Input
                type="number"
                placeholder="Enter price"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                min="0"
                step="0.01"
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Description</label>
              <Textarea
                placeholder="Enter product description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="min-h-[120px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setEditDialogOpen(false);
                setEditingProduct(null);
                setEditPrice("");
                setEditDescription("");
              }}
              disabled={editingInProgress}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateProduct}
              disabled={editingInProgress}
              className="bg-gradient-to-r from-[#1565C0] to-[#1565C0] hover:from-[#0d4f9f] hover:to-[#0d4f9f]"
            >
              {editingInProgress ? "Updating..." : "Update Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
