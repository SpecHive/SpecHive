import { useSearchParams } from 'react-router';

export function useUpdateParam() {
  const [searchParams, setSearchParams] = useSearchParams();

  return (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };
}
