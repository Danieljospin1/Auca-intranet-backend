const getPostById = require('../utils/getPosts');

// Mock the database connection
jest.mock('../database & models/databaseConnection', () => ({
  query: jest.fn(),
}));

const connectionPromise = require('../database & models/databaseConnection');

describe('getPostById', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return post data when post exists (created by student)', async () => {
    const mockPost = {
      Id: 1,
      CreatorId: 'student123',
      Fname: 'John',
      Lname: 'Doe',
      ProfileUrl: 'profile.jpg',
      Role: 'Student',
      Description: 'Test post',
      Timestamp: '2023-01-01 00:00:00',
      FileType: 'image',
      ThumbnailUrl: 'thumb.jpg',
      FullUrl: 'full.jpg',
      FileSize: 1024,
      AudienceType: 'public',
      Department: null,
      PostReactions: 5,
      ReactionTypes: JSON.stringify(['like', 'love']),
      PostComments: 2
    };

    connectionPromise.query.mockResolvedValue([mockPost]);

    const result = await getPostById(1);

    expect(connectionPromise.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      [1]
    );
    expect(result).toEqual(mockPost);
  });

  test('should return post data when post exists (created by staff)', async () => {
    const mockPost = {
      Id: 2,
      CreatorId: 456,
      Fname: 'Jane',
      Lname: 'Smith',
      ProfileUrl: 'staff.jpg',
      Role: 'Lecturer',
      Description: 'Staff post',
      Timestamp: '2023-01-02 00:00:00',
      FileType: null,
      ThumbnailUrl: null,
      FullUrl: null,
      FileSize: null,
      AudienceType: 'private',
      Department: 'CS',
      PostReactions: 0,
      ReactionTypes: null,
      PostComments: 0
    };

    connectionPromise.query.mockResolvedValue([mockPost]);

    const result = await getPostById(2);

    expect(result).toEqual(mockPost);
  });

  test('should return undefined when post does not exist', async () => {
    connectionPromise.query.mockResolvedValue([]);

    const result = await getPostById(999);

    expect(result).toBeUndefined();
  });

  test('should handle database errors', async () => {
    const error = new Error('Database error');
    connectionPromise.query.mockRejectedValue(error);

    await expect(getPostById(1)).rejects.toThrow('Database error');
  });
});