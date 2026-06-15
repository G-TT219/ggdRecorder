import { useState } from 'react';
import MapTab from './MapTab';
import type { MapMarker, Position, RoleKey, Connection } from './MapTab';

function StandaloneMap() {
  const [selectedMap, setSelectedMap] = useState(1);
  const [currentSequence, setCurrentSequence] = useState(1);
  const [mapMarkersByMap, setMapMarkersByMap] = useState<Record<number, MapMarker[]>>({});
  const [roleAssignments, setRoleAssignments] = useState<Record<string, RoleKey>>({});
  const [connectionsByMap, setConnectionsByMap] = useState<Record<number, Connection[]>>({});
  const [markerTrailsByMap, setMarkerTrailsByMap] = useState<Record<number, Record<number, Position[][]>>>({});
  const [deadMarkers, setDeadMarkers] = useState<Record<string, boolean>>({});

  return (
    <MapTab
      selectedMap={selectedMap}
      setSelectedMap={setSelectedMap}
      currentSequence={currentSequence}
      setCurrentSequence={setCurrentSequence}
      mapMarkersByMap={mapMarkersByMap}
      setMapMarkersByMap={setMapMarkersByMap}
      roleAssignments={roleAssignments}
      setRoleAssignments={setRoleAssignments}
      connectionsByMap={connectionsByMap}
      setConnectionsByMap={setConnectionsByMap}
      markerTrailsByMap={markerTrailsByMap}
      setMarkerTrailsByMap={setMarkerTrailsByMap}
      deadMarkers={deadMarkers}
      setDeadMarkers={setDeadMarkers}
    />
  );
}

export default StandaloneMap;
