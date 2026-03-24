import React, { useEffect, useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Snackbar,
  Alert,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import axios from 'axios';
import { formatKES } from '../utils/currency';

function Products() {
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState('');
  const [category, setCategory] = useState('');
  const [storeId, setStoreId] = useState('');
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, storesRes] = await Promise.all([
        axios.get('/api/products'),
        axios.get('/api/stores')
      ]);
      setProducts(productsRes.data);
      setStores(storesRes.data);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    // Reset form
    setProductId('');
    setName('');
    setDescription('');
    setPrice('');
    setImage('');
    setCategory('');
    setStoreId('');
    setAvailable(true);
    setError('');
    setSuccess('');
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      if (productId) {
        // Update product
        await axios.put(`/api/stores/${storeId}/products/${productId}`, {
          name,
          description,
          price: parseFloat(price),
          image,
          category,
          available
        });
        setSnackbarMessage('Product updated successfully!');
        setSnackbarSeverity('success');
      } else {
        // Create product
        await axios.post(`/api/stores/${storeId}/products`, {
          name,
          description,
          price: parseFloat(price),
          image,
          category,
          available
        });
        setSnackbarMessage('Product created successfully!');
        setSnackbarSeverity('success');
      }
      
      setOpen(false);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save product');
      setSnackbarMessage(err.response?.data?.error || 'Failed to save product');
      setSnackbarSeverity('error');
    } finally {
      setSnackbarOpen(true);
    }
  };

  const handleDelete = async (id, storeId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await axios.delete(`/api/stores/${storeId}/products/${id}`);
        setSnackbarMessage('Product deleted successfully!');
        setSnackbarSeverity('success');
        await fetchData();
      } catch (err) {
        setSnackbarMessage('Failed to delete product');
        setSnackbarSeverity('error');
      } finally {
        setSnackbarOpen(true);
      }
    }
  };

  const handleEdit = (product) => {
    setProductId(product.id);
    setName(product.name);
    setDescription(product.description);
    setPrice(product.price.toString());
    setImage(product.image);
    setCategory(product.category);
    setAvailable(product.available);
    setStoreId(product.storeId);
    setOpen(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Products Management</Typography>
        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpen}>
          Add Product
        </Button>
      </Box>
      
      {loading ? (
        <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          {products.length === 0 ? (
            <Typography color="text.secondary">No products found</Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Store</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Availability</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.store?.name || 'Unknown'}</TableCell>
                      <TableCell>{formatKES(Number(product.price || 0))}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>
                        {product.available ? (
                          <Chip label="Available" color="success" />
                        ) : (
                          <Chip label="Unavailable" color="error" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => handleEdit(product)}>
                          Edit
                        </Button>
                        <Button size="small" variant="outlined" startIcon={<DeleteIcon />} color="error" onClick={() => handleDelete(product.id, product.storeId)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}
      
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{productId ? 'Edit Product' : 'Add Product'}</DialogTitle>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <TextField
              label="Product Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              mb={2}
              required
            />
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              mb={2}
              multiline
              rows={4}
            >
              <InputLabel shrink>Description</InputLabel>
            </TextField>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Price (KES)"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                InputLabelProps={{ shrink: true }}
              >
                <InputLabel shrink>Price</InputLabel>
              </TextField>
              <TextField
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                fullWidth
              >
                <InputLabel shrink>Category</InputLabel>
              </TextField>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Image URL"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                fullWidth
              >
                <InputLabel shrink>Image URL</InputLabel>
              </TextField>
              <FormControl fullWidth>
                <InputLabel id="store-label">Store</InputLabel>
                <Select
                  labelId="store-label"
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  label="Store"
                >
                  {stores.map((store) => (
                    <MenuItem key={store.id} value={store.id}>
                      {store.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                  color="primary"
                />
              }
              label="Available"
            />
            {error && (
              <Typography color="error" mb={2}>
                {error}
              </Typography>
            )}
            {success && (
              <Typography color="success" mb={2}>
                {success}
              </Typography>
            )}
          </form>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleSubmit}>
            {productId ? 'Update Product' : 'Add Product'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Products;