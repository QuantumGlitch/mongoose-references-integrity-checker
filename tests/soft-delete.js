const assert = require('assert');
const mongoose = require('mongoose');
const softDeletePlugin = require('mongoose-soft-deleting');
const referencesIntegrityChecker = require('..');
const { RefConstraintError } = referencesIntegrityChecker;

mongoose.connect('mongodb://root@localhost:27017/admin', {
  dbName: 'mongoose-references-integrity-checker',
  useUnifiedTopology: true,
});

mongoose.connection.on('error', console.error.bind(console, "Con't connect to MongoDB."));

describe('References - Simple', async function () {
  // House - 1
  const HouseSchema = new mongoose.Schema({});
  HouseSchema.plugin(softDeletePlugin);
  referencesIntegrityChecker('House', HouseSchema);
  const HouseModel = mongoose.model('House', HouseSchema);

  // Room - N
  const RoomSchema = new mongoose.Schema({
    house: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'House',
      required: true,
    },
  });
  RoomSchema.plugin(softDeletePlugin);
  referencesIntegrityChecker('Room', RoomSchema);
  const RoomModel = mongoose.model('Room', RoomSchema);

  let parent, child;

  before(async function () {
    await HouseModel.deleteMany({});
    await RoomModel.deleteMany({});

    parent = await new HouseModel().save();
    child = await new RoomModel({ house: parent._id }).save();
  });

  it('ref is required, block deleteOne ---> should throw RefConstraintError', async function () {
    try {
      await parent.softDelete(true);
      throw 'This should never happen !';
    } catch (e) {
      if (!(e instanceof RefConstraintError)) throw e;
    }

    child = await RoomModel.findById(child._id);
    assert(!child._deleted, 'child should not be soft deleted');
    assert(child.house.equals(parent._id), 'child should have ref to parent');
  });

  it('ref is not required, deleteOne ---> should just soft delete the parent of the relationship', async function () {
    RoomSchema.path('house').required = false;
    await parent.softDelete(true);
    assert((await HouseModel.findById(parent._id))._deleted, 'parent should be soft deleted');

    child = await RoomModel.findById(child._id);
    assert(
      child.house.equals(parent._id),
      "child's ref to deleted parent should be there anyway (the referenced document still exists)"
    );
  });

  it('ref is required, deleteOne cascade ---> should soft delete and restore the parent of the relationship and his children', async function () {
    RoomSchema.path('house').required = true;
    RoomSchema.path('house').cascade = true;

    parent = await new HouseModel().save();
    const children = [
      await new RoomModel({ house: parent._id }).save(),
      await new RoomModel({ house: parent._id }).save(),
      await new RoomModel({ house: parent._id }).save(),
    ];

    await parent.softDelete(true);

    assert((await HouseModel.findById(parent._id))._deleted, 'parent should be soft deleted');
    assert((await RoomModel.findById(children[0]._id))._deleted, 'child should be soft deleted');
    assert((await RoomModel.findById(children[1]._id))._deleted, 'child should be soft deleted');
    assert((await RoomModel.findById(children[2]._id))._deleted, 'child should be soft deleted');

    // Restore
    await parent.softDelete(false);

    assert(!(await HouseModel.findById(parent._id))._deleted, 'parent should not be soft deleted');
    assert(!(await RoomModel.findById(children[0]._id))._deleted, 'child should not be soft deleted');
    assert(!(await RoomModel.findById(children[1]._id))._deleted, 'child should not be soft deleted');
    assert(!(await RoomModel.findById(children[2]._id))._deleted, 'child should not be soft deleted');
  });
});
