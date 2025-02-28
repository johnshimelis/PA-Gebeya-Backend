const Cart = require("../models/Cart");
const path = require("path");

// Get cart items for a specific user
exports.getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    res.json(cart || { userId, items: [] });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// Add an item to the cart (handling form-data with image upload)
exports.addToCart = async (req, res) => {
  try {
    console.log("Received Body:", req.body);
    console.log("Received File:", req.file);

    // Trim spaces from keys before destructuring
    const sanitizedBody = Object.fromEntries(
      Object.entries(req.body).map(([key, value]) => [key.trim(), value])
    );

    const { userId, productId, productName, price, quantity } = sanitizedBody;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Validate required fields
    if (!userId || !productId || !productName || price === undefined) {
      return res.status(400).json({ error: "Missing required fields", receivedData: sanitizedBody });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingItem = cart.items.find(item => item.productId.toString() === productId);

    if (existingItem) {
      existingItem.quantity += Number(quantity) || 1;
    } else {
      cart.items.push({
        productId,
        productName,
        img: imageUrl,
        price: Number(price),
        quantity: Number(quantity) || 1,
      });
    }

    await cart.save();
    res.status(200).json({ message: "Item added to cart", cart });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ error: "Server error" });
  }
};


// Remove an item from the cart
exports.removeFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await Cart.findOne({ userId });

    if (!cart) return res.status(404).json({ message: "Cart not found" });

    cart.items = cart.items.filter((item) => item.productId.toString() !== req.params.id);
    await cart.save();

    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: "Failed to remove item", error });
  }
};

// Update item quantity in the cart
exports.updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;
    const userId = req.user.id;
    const cart = await Cart.findOne({ userId });

    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.items.find((item) => item.productId.toString() === req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found in cart" });

    item.quantity = Number(quantity);
    await cart.save();

    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: "Failed to update quantity", error });
  }
};

// Clear the entire cart
// Clear the entire cart by userId
// Clear the cart by a specific userId
exports.clearCartByUserId = async (req, res) => {
  try {
    const { userId } = req.params; // Get userId from request parameters
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const deletedCart = await Cart.findOneAndDelete({ userId });
    if (!deletedCart) {
      return res.status(404).json({ message: "Cart not found for this user" });
    }

    res.json({ message: `Cart for user ${userId} cleared successfully` });
  } catch (error) {
    res.status(500).json({ message: "Failed to clear cart", error });
  }
};


