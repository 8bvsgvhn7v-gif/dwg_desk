#include "dwg.h"
#include "dwg_api.h"
int main(int argc,char **argv) {
  if(argc!=2)return 1;
  Dwg_Data *dwg=dwg_new_Document(R_2000,0,0);
  return dwg_write_file(argv[1],dwg)>=DWG_ERR_CRITICAL?1:0;
}
