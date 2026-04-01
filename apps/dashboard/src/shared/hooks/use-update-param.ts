import { useSearchParams } from 'react-router';

export function useUpdateParam() {
  const [, setSearchParams] = useSearchParams();

  return (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      if (key !== 'page') next.delete('page');
      return next;
    });
  };
}
