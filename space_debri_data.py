from spacetrack import SpaceTrackClient

import datetime as dt
import spacetrack.operators as op
# import json

identity = 'ozumozen@gmail.com'
password = '3ea65PdUsSDp_F_'
st = SpaceTrackClient(identity, password)


debri_data = st.gp(iter_lines=False,  epoch='>now-30',
                              object_type ='Debris',
                              orderby='TLE_LINE1',
                              format='tle').split('\n')

data = ['tleArray_g = [']
  
# data = {}
# data['debri'] = []
for idx in list(range(0,len(debri_data)-1,2)):

#     data['debri'].append({
#     'id': int(debri_data[idx][2:7]),
#     'Line1': debri_data[idx],
#     'Line2': debri_data[idx+1]
# })
    data.append('{"id":'+str(int(debri_data[idx][2:7]))+', "Line1":'+str(debri_data[idx])+', "Line2":'+str(debri_data[idx+1])+'},')
data.append('];')

data = ''.join(data)
with open("spacetrack.js", 'w') as datafile:
     datafile.write((data))