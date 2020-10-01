const assert = require('assert');
const mongoose = require('mongoose');
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
      await parent.deleteOne();
      throw 'This should never happen !';
    } catch (e) {
      if (!(e instanceof RefConstraintError)) throw e;
    }

    child = await RoomModel.findById(child._id);
    assert(child, 'child should exists');
    assert(child.house.equals(parent._id), 'child should have ref to parent');
  });

  it('ref is not required, deleteOne ---> should just delete the parent of the relationship', async function () {
    RoomSchema.path('house').required = false;
    await parent.deleteOne();
    assert(!(await HouseModel.findById(parent._id)), "parent shouldn't exists");

    child = await RoomModel.findById(child._id);
    assert(!child.house, "child's ref to deleted parent should be null");
  });

  it('ref is required, deleteOne cascade ---> should delete the parent of the relationship and his children', async function () {
    RoomSchema.path('house').required = true;
    RoomSchema.path('house').cascade = true;

    parent = await new HouseModel().save();
    const children = [
      await new RoomModel({ house: parent._id }).save(),
      await new RoomModel({ house: parent._id }).save(),
      await new RoomModel({ house: parent._id }).save(),
    ];

    await parent.deleteOne();

    assert(!(await HouseModel.findById(parent._id)), "parent shouldn't exists");
    assert(!(await RoomModel.findById(children[0]._id)), "child shouldn't exists");
    assert(!(await RoomModel.findById(children[1]._id)), "child shouldn't exists");
    assert(!(await RoomModel.findById(children[2]._id)), "child shouldn't exists");
  });
});

describe('References - SingleNestedPath', async function () {
  // House - 1
  const HouseSchema = new mongoose.Schema({});
  referencesIntegrityChecker('HouseSingleNested', HouseSchema);
  const HouseModel = mongoose.model('HouseSingleNested', HouseSchema);

  // Room - N
  const RoomSchema = new mongoose.Schema({
    nested: {
      house: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HouseSingleNested',
        required: true,
      },
    },
  });
  referencesIntegrityChecker('RoomSingleNested', RoomSchema);
  const RoomModel = mongoose.model('RoomSingleNested', RoomSchema);

  let parent, child;

  before(async function () {
    await HouseModel.deleteMany({});
    await RoomModel.deleteMany({});

    parent = await new HouseModel().save();
    child = await new RoomModel({ nested: { house: parent._id } }).save();
  });

  it('ref is required, block deleteOne ---> should throw RefConstraintError', async function () {
    try {
      await parent.deleteOne();
      throw 'This should never happen !';
    } catch (e) {
      if (!(e instanceof RefConstraintError)) throw e;
    }

    child = await RoomModel.findById(child._id);
    assert(child, 'child should exists');
    assert(child.nested.house.equals(parent._id), 'child should have ref to parent');
  });

  it('ref is not required, deleteOne ---> should just delete the parent of the relationship', async function () {
    RoomSchema.path('nested.house').required = false;
    await parent.deleteOne();
    assert(!(await HouseModel.findById(parent._id)), "parent shouldn't exists");

    child = await RoomModel.findById(child._id);
    assert(!child.nested.house, "child's ref to deleted parent should be null");
  });

  it('ref is required, deleteOne cascade ---> should delete the parent of the relationship and his children', async function () {
    RoomSchema.path('nested.house').required = true;
    RoomSchema.path('nested.house').cascade = true;

    parent = await new HouseModel().save();
    const children = [
      await new RoomModel({ nested: { house: parent._id } }).save(),
      await new RoomModel({ nested: { house: parent._id } }).save(),
      await new RoomModel({ nested: { house: parent._id } }).save(),
    ];

    await parent.deleteOne();

    assert(!(await HouseModel.findById(parent._id)), "parent shouldn't exists");
    assert(!(await RoomModel.findById(children[0]._id)), "child shouldn't exists");
    assert(!(await RoomModel.findById(children[1]._id)), "child shouldn't exists");
    assert(!(await RoomModel.findById(children[2]._id)), "child shouldn't exists");
  });
});

describe('References - MultipleNestedPath', async function () {
  // House - 1
  const HouseSchema = new mongoose.Schema({});
  referencesIntegrityChecker('HouseMultipleNested', HouseSchema);
  const HouseModel = mongoose.model('HouseMultipleNested', HouseSchema);

  // Room - N
  const RoomSchema = new mongoose.Schema({
    nested: {
      nested: {
        nested: {
          house: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HouseMultipleNested',
            required: true,
          },
        },
      },
    },
  });
  referencesIntegrityChecker('RoomMultipleNested', RoomSchema);
  const RoomModel = mongoose.model('RoomMultipleNested', RoomSchema);

  let parent, child;

  before(async function () {
    await HouseModel.deleteMany({});
    await RoomModel.deleteMany({});

    parent = await new HouseModel().save();
    child = await new RoomModel({ nested: { nested: { nested: { house: parent._id } } } }).save();
  });

  it('ref is required, block deleteOne ---> should throw RefConstraintError', async function () {
    try {
      await parent.deleteOne();
      throw 'This should never happen !';
    } catch (e) {
      if (!(e instanceof RefConstraintError)) throw e;
    }

    child = await RoomModel.findById(child._id);
    assert(child, 'child should exists');
    assert(child.nested.nested.nested.house.equals(parent._id), 'child should have ref to parent');
  });

  it('ref is not required, deleteOne ---> should just delete the parent of the relationship', async function () {
    RoomSchema.path('nested.nested.nested.house').required = false;
    await parent.deleteOne();
    assert(!(await HouseModel.findById(parent._id)), "parent shouldn't exists");

    child = await RoomModel.findById(child._id);
    assert(!child.nested.nested.nested.house, "child's ref to deleted parent should be null");
  });

  it('ref is required, deleteOne cascade ---> should delete the parent of the relationship and his children', async function () {
    RoomSchema.path('nested.nested.nested.house').required = true;
    RoomSchema.path('nested.nested.nested.house').cascade = true;

    parent = await new HouseModel().save();
    const children = [
      await new RoomModel({ nested: { nested: { nested: { house: parent._id } } } }).save(),
      await new RoomModel({ nested: { nested: { nested: { house: parent._id } } } }).save(),
      await new RoomModel({ nested: { nested: { nested: { house: parent._id } } } }).save(),
    ];

    await parent.deleteOne();

    assert(!(await HouseModel.findById(parent._id)), "parent shouldn't exists");
    assert(!(await RoomModel.findById(children[0]._id)), "child shouldn't exists");
    assert(!(await RoomModel.findById(children[1]._id)), "child shouldn't exists");
    assert(!(await RoomModel.findById(children[2]._id)), "child shouldn't exists");
  });
});

describe('References - Array of Refs', async function () {
  // House - N
  const HouseSchema = new mongoose.Schema({});
  referencesIntegrityChecker('HouseArray', HouseSchema);
  const HouseModel = mongoose.model('HouseArray', HouseSchema);

  // Room - N
  const RoomSchema = new mongoose.Schema({
    houses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HouseArray',
        required: true,
      },
    ],
  });
  referencesIntegrityChecker('RoomArray', RoomSchema);
  const RoomModel = mongoose.model('RoomArray', RoomSchema);

  let parents = [],
    child;

  before(async function () {
    await HouseModel.deleteMany({});
    await RoomModel.deleteMany({});

    parents.push(await new HouseModel().save());
    parents.push(await new HouseModel().save());

    child = await new RoomModel({ houses: [parents[0]._id, parents[1]._id] }).save();
  });

  it('ref is required, block deleteOne ---> should throw RefConstraintError', async function () {
    try {
      await parents[0].deleteOne();
      throw 'This should never happen !';
    } catch (e) {
      if (!(e instanceof RefConstraintError)) throw e;
    }

    child = await RoomModel.findById(child._id);
    assert(child, 'child should exists');
    assert(
      child.houses.find((h) => h.equals(parents[0]._id)),
      'child should contains ref to parent'
    );
  });

  it('ref is not required, deleteOne ---> should just delete the parent of the relationship and remove its ref from the array of the child', async function () {
    RoomSchema.path('houses').options.type[0].required = false;
    await parents[0].deleteOne();
    assert(!(await HouseModel.findById(parents[0]._id)), "parent shouldn't exists");

    child = await RoomModel.findById(child._id);
    assert(
      !child.houses.find((h) => h._id.equals(parents[0]._id)),
      "child's ref to deleted parent should be null"
    );
  });

  it('ref is required, deleteOne cascade ---> should delete the parent of the relationship and the children', async function () {
    RoomSchema.path('houses').options.type[0].required = true;
    RoomSchema.path('houses').options.type[0].cascade = true;

    const children = [
      await new RoomModel({ houses: [parents[0]._id, parents[1]._id] }).save(),
      await new RoomModel({ houses: [parents[0]._id] }).save(),
      await new RoomModel({ houses: [parents[1]._id] }).save(),
    ];

    await parents[0].deleteOne();
    assert(!(await HouseModel.findById(parents[0]._id)), "parent shouldn't exists");

    child = await RoomModel.findById(children[0]._id);
    assert(!child, 'child should be deleted');

    child = await RoomModel.findById(children[1]._id);
    assert(!child, 'child should be deleted');

    child = await RoomModel.findById(children[2]._id);
    assert(child, "child's with no ref should exists");
  });
});

describe('References - Array of Objects', async function () {
  // House - N
  const HouseSchema = new mongoose.Schema({});
  referencesIntegrityChecker('HouseArrayObjects', HouseSchema);
  const HouseModel = mongoose.model('HouseArrayObjects', HouseSchema);

  // Room - N
  const RoomSchema = new mongoose.Schema({
    houses: [
      {
        house: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'HouseArrayObjects',
          required: true,
        },
      },
    ],
  });
  referencesIntegrityChecker('RoomArrayObjects', RoomSchema);
  const RoomModel = mongoose.model('RoomArrayObjects', RoomSchema);

  let parents = [],
    child;

  before(async function () {
    await HouseModel.deleteMany({});
    await RoomModel.deleteMany({});

    parents.push(await new HouseModel().save());
    parents.push(await new HouseModel().save());

    child = await new RoomModel({
      houses: [{ house: parents[0]._id }, { house: parents[1]._id }],
    }).save();
  });

  it('ref is required, block deleteOne ---> should throw RefConstraintError', async function () {
    try {
      await parents[0].deleteOne();
      throw 'This should never happen !';
    } catch (e) {
      if (!(e instanceof RefConstraintError)) throw e;
    }

    child = await RoomModel.findById(child._id);
    assert(child, 'child should exists');
    assert(
      child.houses.find((h) => h.house.equals(parents[0]._id)),
      'child should contains ref to parent'
    );
  });

  it('ref is not required, deleteOne ---> should just delete the parent of the relationship and set null its ref in the child', async function () {
    RoomSchema.path('houses.house').required = false;
    await parents[0].deleteOne();
    assert(!(await HouseModel.findById(parents[0]._id)), "parent shouldn't exists");

    child = await RoomModel.findById(child._id);
    assert(
      !child.houses.find((h) => h.house && h.house.equals(parents[0]._id)),
      "child's ref to deleted parent should be null"
    );
  });

  it('ref is required, deleteOne cascade ---> should delete the parent of the relationship and the children', async function () {
    RoomSchema.path('houses.house').required = true;
    RoomSchema.path('houses.house').cascade = true;

    const children = [
      await new RoomModel({
        houses: [{ house: parents[0]._id }, { house: parents[1]._id }],
      }).save(),
      await new RoomModel({ houses: [{ house: parents[0]._id }] }).save(),
      await new RoomModel({ houses: [{ house: parents[1]._id }] }).save(),
    ];

    await parents[0].deleteOne();
    assert(!(await HouseModel.findById(parents[0]._id)), "parent shouldn't exists");

    child = await RoomModel.findById(children[0]._id);
    assert(!child, 'child should be deleted');

    child = await RoomModel.findById(children[1]._id);
    assert(!child, 'child should be deleted');

    child = await RoomModel.findById(children[2]._id);
    assert(child, "child's with no ref should exists");
  });
});

describe('References - Array of Single Nested Objects', async function () {
  // House - N
  const HouseSchema = new mongoose.Schema({});
  referencesIntegrityChecker('HouseArraySingleNestedObjects', HouseSchema);
  const HouseModel = mongoose.model('HouseArraySingleNestedObjects', HouseSchema);

  // Room - N
  const RoomSchema = new mongoose.Schema({
    houses: [
      {
        house: {
          house: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HouseArraySingleNestedObjects',
            required: true,
          },
        },
      },
    ],
  });
  referencesIntegrityChecker('RoomArraySingleNestedObjects', RoomSchema);
  const RoomModel = mongoose.model('RoomArraySingleNestedObjects', RoomSchema);

  let parents = [],
    child;

  before(async function () {
    await HouseModel.deleteMany({});
    await RoomModel.deleteMany({});

    parents.push(await new HouseModel().save());
    parents.push(await new HouseModel().save());

    child = await new RoomModel({
      houses: [{ house: { house: parents[0]._id } }, { house: { house: parents[1]._id } }],
    }).save();
  });

  it('ref is required, block deleteOne ---> should throw RefConstraintError', async function () {
    try {
      await parents[0].deleteOne();
      throw 'This should never happen !';
    } catch (e) {
      if (!(e instanceof RefConstraintError)) throw e;
    }

    child = await RoomModel.findById(child._id);
    assert(child, 'child should exists');
    assert(
      child.houses.find((h) => h.house.house.equals(parents[0]._id)),
      'child should contains ref to parent'
    );
  });

  it('ref is not required, deleteOne ---> should just delete the parent of the relationship and set null its ref in the child', async function () {
    RoomSchema.path('houses.house.house').required = false;

    await parents[0].deleteOne();
    assert(!(await HouseModel.findById(parents[0]._id)), "parent shouldn't exists");

    child = await RoomModel.findById(child._id);
    assert(
      !child.houses.find((h) => h.house.house && h.house.house.equals(parents[0]._id)),
      "child's ref to deleted parent should be null"
    );
  });

  it('ref is required, deleteOne cascade ---> should delete the parent of the relationship and the children', async function () {
    RoomSchema.path('houses.house.house').required = true;
    RoomSchema.path('houses.house.house').cascade = true;

    const children = [
      await new RoomModel({
        houses: [{ house: { house: parents[0]._id } }, { house: { house: parents[1]._id } }],
      }).save(),
      await new RoomModel({ houses: [{ house: { house: parents[0]._id } }] }).save(),
      await new RoomModel({ houses: [{ house: { house: parents[1]._id } }] }).save(),
    ];

    await parents[0].deleteOne();
    assert(!(await HouseModel.findById(parents[0]._id)), "parent shouldn't exists");

    child = await RoomModel.findById(children[0]._id);
    assert(!child, 'child should be deleted');

    child = await RoomModel.findById(children[1]._id);
    assert(!child, 'child should be deleted');

    child = await RoomModel.findById(children[2]._id);
    assert(child, "child's with no ref should exists");
  });
});

describe('References - Array of Multiple Nested Objects', async function () {
  // House - N
  const HouseSchema = new mongoose.Schema({});
  referencesIntegrityChecker('HouseArrayMultipleNestedObjects', HouseSchema);
  const HouseModel = mongoose.model('HouseArrayMultipleNestedObjects', HouseSchema);

  // Room - N
  const RoomSchema = new mongoose.Schema({
    houses: [
      {
        house: {
          house: {
            house: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'HouseArrayMultipleNestedObjects',
              required: true,
            },
          },
        },
      },
    ],
  });
  referencesIntegrityChecker('RoomArrayMultipleNestedObjects', RoomSchema);
  const RoomModel = mongoose.model('RoomArrayMultipleNestedObjects', RoomSchema);

  let parents = [],
    child;

  before(async function () {
    await HouseModel.deleteMany({});
    await RoomModel.deleteMany({});

    parents.push(await new HouseModel().save());
    parents.push(await new HouseModel().save());

    child = await new RoomModel({
      houses: [
        { house: { house: { house: parents[0]._id } } },
        { house: { house: { house: parents[1]._id } } },
      ],
    }).save();
  });

  it('ref is required, block deleteOne ---> should throw RefConstraintError', async function () {
    try {
      await parents[0].deleteOne();
      throw 'This should never happen !';
    } catch (e) {
      if (!(e instanceof RefConstraintError)) throw e;
    }

    child = await RoomModel.findById(child._id);
    assert(child, 'child should exists');
    assert(
      child.houses.find((h) => h.house.house.house.equals(parents[0]._id)),
      'child should contains ref to parent'
    );
  });

  it('ref is not required, deleteOne ---> should just delete the parent of the relationship and set null its ref in the child', async function () {
    RoomSchema.path('houses.house.house.house').required = false;

    await parents[0].deleteOne();
    assert(!(await HouseModel.findById(parents[0]._id)), "parent shouldn't exists");

    child = await RoomModel.findById(child._id);
    assert(
      !child.houses.find((h) => h.house.house.house && h.house.house.house.equals(parents[0]._id)),
      "child's ref to deleted parent should be null"
    );
  });

  it('ref is required, deleteOne cascade ---> should delete the parent of the relationship and the children', async function () {
    RoomSchema.path('houses.house.house.house').required = true;
    RoomSchema.path('houses.house.house.house').cascade = true;

    const children = [
      await new RoomModel({
        houses: [
          { house: { house: { house: parents[0]._id } } },
          { house: { house: { house: parents[1]._id } } },
        ],
      }).save(),
      await new RoomModel({ houses: [{ house: { house: { house: parents[0]._id } } }] }).save(),
      await new RoomModel({ houses: [{ house: { house: { house: parents[1]._id } } }] }).save(),
    ];

    await parents[0].deleteOne();
    assert(!(await HouseModel.findById(parents[0]._id)), "parent shouldn't exists");

    child = await RoomModel.findById(children[0]._id);
    assert(!child, 'child should be deleted');

    child = await RoomModel.findById(children[1]._id);
    assert(!child, 'child should be deleted');

    child = await RoomModel.findById(children[2]._id);
    assert(child, "child's with no ref should exists");
  });
});

describe('References - Nested Arrays', async function () {
  // House - N
  const HouseSchema = new mongoose.Schema({});
  referencesIntegrityChecker('HouseNestedArrays', HouseSchema);
  const HouseModel = mongoose.model('HouseNestedArrays', HouseSchema);

  // Room - N
  const RoomSchema = new mongoose.Schema({
    houses: [
      {
        house: {
          houses: [
            {
              house: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'HouseNestedArrays',
                required: true,
              },
            },
          ],
        },
      },
    ],
  });
  referencesIntegrityChecker('RoomNestedArrays', RoomSchema);
  const RoomModel = mongoose.model('RoomNestedArrays', RoomSchema);

  let parents = [],
    child;

  before(async function () {
    await HouseModel.deleteMany({});
    await RoomModel.deleteMany({});

    parents.push(await new HouseModel().save());
    parents.push(await new HouseModel().save());

    child = await new RoomModel({
      houses: [
        { house: { houses: [{ house: parents[0]._id }] } },
        { house: { houses: [{ house: parents[1]._id }] } },
      ],
    }).save();
  });

  it('ref is required, block deleteOne ---> should throw RefConstraintError', async function () {
    try {
      await parents[0].deleteOne();
      throw 'This should never happen !';
    } catch (e) {
      if (!(e instanceof RefConstraintError)) throw e;
    }

    child = await RoomModel.findById(child._id);
    assert(child, 'child should exists');
    assert(
      child.houses.find((h) => !!h.house.houses.find((h2) => h2.house.equals(parents[0]._id))),
      'child should contains ref to parent'
    );
  });

  it('ref is not required, deleteOne ---> should just delete the parent of the relationship and set null its ref in the child', async function () {
    RoomSchema.path('houses.house.houses.house').required = false;

    await parents[0].deleteOne();
    assert(!(await HouseModel.findById(parents[0]._id)), "parent shouldn't exists");

    child = await RoomModel.findById(child._id);
    assert(
      !child.houses.find(
        (h) => !!h.house.houses.find((h2) => h2.house && h2.house.equals(parents[0]._id))
      ),
      "child's ref to deleted parent should be null"
    );
  });

  it('ref is required, deleteOne cascade ---> should delete the parent of the relationship and the children', async function () {
    RoomSchema.path('houses.house.houses.house').required = true;
    RoomSchema.path('houses.house.houses.house').cascade = true;

    const children = [
      await new RoomModel({
        houses: [
          { house: { houses: [{ house: parents[0]._id }] } },
          { house: { houses: [{ house: parents[1]._id }] } },
        ],
      }).save(),
      await new RoomModel({ houses: [{ house: { houses: [{ house: parents[0]._id }] } }] }).save(),
      await new RoomModel({ houses: [{ house: { houses: [{ house: parents[1]._id }] } }] }).save(),
    ];

    await parents[0].deleteOne();
    assert(!(await HouseModel.findById(parents[0]._id)), "parent shouldn't exists");

    child = await RoomModel.findById(children[0]._id);
    assert(!child, 'child should be deleted');

    child = await RoomModel.findById(children[1]._id);
    assert(!child, 'child should be deleted');

    child = await RoomModel.findById(children[2]._id);
    assert(child, "child's with no ref should exists");
  });
});
