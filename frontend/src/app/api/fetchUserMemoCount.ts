export async function fetchUserMemoCount(): Promise<number> {
  try {
    const response = await fetch('/api/memos/count');
    if (!response.ok) {
      throw new Error('메모 개수를 가져오는데 실패했습니다.');
    }
    const data = await response.json();
    return data.count;
  } catch (error) {
    console.error('Error fetching memo count:', error);
    return 0;
  }
}
