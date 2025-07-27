const Group = require('../models/Group');
const List = require('../models/List');
const Item = require('../models/Item');
const PurchaseHistory = require('../models/PurchaseHistory');
const User = require('../models/User');

// GET /groups/:groupId/list/summary
exports.getGroupListSummary = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    console.log(`[DEBUG] Getting summary for group: ${groupId}`);
    
    const group = await Group.findById(groupId).populate({
      path: 'list',
      populate: { path: 'items', populate: { path: 'addedBy', select: 'username profilePicUrl' } }
    });
    
    if (!group || !group.list) {
      console.log(`[DEBUG] Group or list not found for groupId: ${groupId}`);
      return res.status(404).json({ message: 'Group or shared list not found' });
    }
    
    // Current list items - filter to ensure only valid items
    const currentList = group.list.items
      .filter(item => 
        item && 
        item.name && 
        item.barcode && 
        /^[0-9A-Za-z]+$/.test(item.barcode)
      )
      .map(item => ({
        _id: item._id,
        name: item.name,
        barcode: item.barcode,
        quantity: item.quantity || 1,
        img: item.img || null,
        icon: item.icon || null,
        addedBy: item.addedBy,
        createdAt: item.createdAt,
        productId: item.productId
      }));
    
    console.log(`[DEBUG] Group ${groupId} has ${group.list.items.length} total items`);
    console.log(`[DEBUG] Group ${groupId} has ${currentList.length} valid items with barcodes`);
    console.log(`[DEBUG] Items in group ${groupId}:`, currentList.map(item => `${item.name} (${item.barcode})`));
    
    // DEBUG: Check if images are being preserved
    console.log(`[DEBUG] === CHECKING IMAGES IN CURRENT LIST ===`);
    currentList.forEach((item, index) => {
      console.log(`[DEBUG] Item ${index + 1}: ${item.name}`);
      console.log(`[DEBUG]   - Has img field: ${!!item.img}`);
      console.log(`[DEBUG]   - Has icon field: ${!!item.icon}`);
      console.log(`[DEBUG]   - img length: ${item.img ? item.img.length : 0}`);
      console.log(`[DEBUG]   - icon length: ${item.icon ? item.icon.length : 0}`);
    });
    
    // Last bought: get most recent group trip from PurchaseHistory
    const lastTrip = await PurchaseHistory.find({ group: groupId })
      .sort({ boughtAt: -1 })
      .limit(1);
    let lastBought = [];
    let lastStore = null;
    if (lastTrip.length > 0) {
      // Get all items from the most recent trip (same boughtAt timestamp)
      const lastBoughtAt = lastTrip[0].boughtAt;
      lastBought = await PurchaseHistory.find({ group: groupId, boughtAt: lastBoughtAt });
      lastStore = lastTrip[0].metadata && lastTrip[0].metadata.store ? lastTrip[0].metadata.store : null;
    }
    
    // Trip count
    const tripCount = await PurchaseHistory.countDocuments({ group: groupId });
    
    const result = { currentList, lastBought, lastStore, tripCount };
    console.log(`[DEBUG] Returning summary for group ${groupId}:`, {
      currentListCount: currentList.length,
      lastBoughtCount: lastBought.length,
      tripCount
    });
    
    res.json(result);
  } catch (err) {
    console.error('Error in getGroupListSummary:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /groups/:groupId/list/complete-trip
exports.completeGroupTrip = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.userId;
    const { store } = req.body || {};
    const group = await Group.findById(groupId).populate({
      path: 'list',
      populate: { path: 'items' }
    });
    if (!group || !group.list) {
      return res.status(404).json({ message: 'Group or shared list not found' });
    }
    const list = group.list;
    const items = list.items;
    if (!items.length) {
      return res.status(400).json({ message: 'No items to complete trip' });
    }
    // Record each item in PurchaseHistory
    const now = new Date();
    for (const item of items) {
      await PurchaseHistory.create({
        name: item.name,
        product: item.product,
        quantity: item.quantity,
        user: userId,
        group: groupId,
        boughtAt: now,
        img: item.img || item.icon || '', // Save image for last bought
        metadata: store ? { store } : {},
      });
      await Item.findByIdAndDelete(item._id);
    }
    // Clear the list
    list.items = [];
    await list.save();
    res.json({ message: 'Trip completed', boughtAt: now });
  } catch (err) {
    console.error('Error in completeGroupTrip:', err);
    res.status(500).json({ message: 'Server error' });
  }
}; 