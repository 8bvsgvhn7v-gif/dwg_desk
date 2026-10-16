// DXF 2007+ stores strings as UTF-8 even when its legacy codepage header remains ANSI.
// The renderer prioritizes that header, so provide a UTF-8 BOM on the parsing copy.
export function dxfForViewer(bytes,name){
  if(!/\.dxf$/i.test(name)||bytes[0]===0xef)return bytes;
  const header=new TextDecoder('iso-8859-1').decode(bytes.subarray(0,131072));
  if(header.startsWith('AutoCAD Binary DXF'))return bytes;
  const version=header.match(/\$ACADVER\s*\r?\n\s*1\s*\r?\nAC(\d+)/)?.[1];
  if(!version||Number(version)<1021)return bytes;
  try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return bytes;}
  const result=new Uint8Array(bytes.length+3);result.set([0xef,0xbb,0xbf]);result.set(bytes,3);return result;
}
