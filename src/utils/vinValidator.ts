export function isValidVin(vin: string): boolean {
  if (!vin) return false;

  const cleaned = vin.trim().toUpperCase();

  // VIN must be 17 characters and exclude I,O,Q
  const regex = /^[A-HJ-NPR-Z0-9]{17}$/;

  return regex.test(cleaned);
}

export function isValidVinChecksum(vin: string): boolean {
  const map: Record<string, number> = {
    A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,
    J:1,K:2,L:3,M:4,N:5,P:7,R:9,
    S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9,
    "0":0,"1":1,"2":2,"3":3,"4":4,
    "5":5,"6":6,"7":7,"8":8,"9":9
  };

  const weights = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];

  const sum = vin.split("").reduce((acc, char, i) => {
    return acc + map[char] * weights[i];
  }, 0);

  const remainder = sum % 11;
  const check = remainder === 10 ? "X" : String(remainder);

  return vin[8] === check;
}