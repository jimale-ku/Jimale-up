const Group = require('../models/Group');
const List = require('../models/List');
const Item = require('../models/Item');
const PurchaseHistory = require('../models/PurchaseHistory');
const User = require('../models/User');

// GET /groups/:groupId/list/summary
exports.getGroupListSummary = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const group = await Group.findById(groupId).populate({
      path: 'list',
      populate: { path: 'items', populate: { path: 'addedBy', select: 'username profilePicUrl' } }
    });
    if (!group || !group.list) {
      return res.status(404).json({ message: 'Group or shared list not found' });
    }
    // Current list items
    const currentList = group.list.items;
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
    res.json({ currentList, lastBought, lastStore, tripCount });
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