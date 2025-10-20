import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { GroupType } from '../types/groups';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export default function CreateGroup() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<GroupType | null>(null);

  if (!selectedType) {
    // Step 1: Select group type
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/messages/groups')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">Ny grupp</h1>
          </div>
        </div>

        {/* Type selector */}
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Välj grupptyp</h2>

          <div className="space-y-3">
            {/* Static group option */}
            <Card
              className="cursor-pointer hover:border-blue-500 transition-colors"
              onClick={() => setSelectedType('static')}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                    👥
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">Fast grupp</h3>
                    <p className="text-sm text-gray-600">
                      Lägg till och ta bort medlemmar manuellt
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-gray-400">
                    →
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dynamic group option */}
            <Card
              className="cursor-pointer hover:border-purple-500 transition-colors"
              onClick={() => setSelectedType('dynamic')}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-2xl">
                    ⚡
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">Dynamisk grupp</h3>
                    <p className="text-sm text-gray-600">
                      Medlemmar väljs automatiskt baserat på regler
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-gray-400">
                    →
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Group creation form (static for now)
  if (selectedType === 'static') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedType(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-semibold">Ny fast grupp</h1>
            </div>
            <Button size="sm" disabled>
              Skapa
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="p-4">
          <div className="space-y-6">
            {/* Group name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gruppnamn *
              </label>
              <input
                type="text"
                placeholder="t.ex. Styrelsen"
                className="
                  w-full px-4 py-2
                  border border-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  placeholder:text-gray-400
                "
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Beskrivning (valfritt)
              </label>
              <textarea
                placeholder="Beskriv gruppen..."
                rows={3}
                className="
                  w-full px-4 py-2
                  border border-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  placeholder:text-gray-400
                  resize-none
                "
              />
            </div>

            {/* Members */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Medlemmar (0)
              </label>
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 text-center text-sm text-gray-600">
                Medlemsväljare kommer snart...
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Dynamic group form (placeholder)
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedType(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">Ny dynamisk grupp</h1>
          </div>
          <Button size="sm" disabled>
            Skapa
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="p-4">
        <div className="space-y-6">
          {/* Group name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gruppnamn *
            </label>
            <input
              type="text"
              placeholder="t.ex. Bastat senaste veckan"
              className="
                w-full px-4 py-2
                border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-purple-500
                placeholder:text-gray-400
              "
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Beskrivning (valfritt)
            </label>
            <textarea
              placeholder="Beskriv gruppen..."
              rows={3}
              className="
                w-full px-4 py-2
                border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-purple-500
                placeholder:text-gray-400
                resize-none
              "
            />
          </div>

          {/* Rules */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Regler
            </label>
            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 text-center text-sm text-gray-600">
              Regelbyggare kommer snart...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
