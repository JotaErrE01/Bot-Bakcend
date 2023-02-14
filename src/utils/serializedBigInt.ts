
export const serializeBigInt = (data: any) => {
  return JSON.parse(JSON.stringify(
    data,
    (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }
  ));
}
