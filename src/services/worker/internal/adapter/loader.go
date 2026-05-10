package adapter

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"arkloop/services/shared/config"
)

// Loader loads adapter configs from various sources.
type Loader interface {
	LoadAll(ctx context.Context) ([]Config, error)
}

// FileLoader loads adapter configs from a directory of JSON files.
type FileLoader struct {
	Dir string
}

// LoadAll reads all *.json files from the directory recursively.
func (fl *FileLoader) LoadAll(ctx context.Context) ([]Config, error) {
	if fl.Dir == "" {
		return nil, nil
	}

	var configs []Config
	err := filepath.WalkDir(fl.Dir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			return fmt.Errorf("walk adapter config dir %q: %w", fl.Dir, err)
		}
		if d.IsDir() || !strings.HasSuffix(d.Name(), ".json") {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read adapter config %q: %w", path, err)
		}

		// 支持三种格式：
		// 1. JSON 数组（旧格式，多个 adapter 的扁平数组）
		// 2. JSON 对象（单个 adapter）
		// 3. ConfigFile 对象（新格式：{ system, version, adapters: [...] }）
		if len(data) > 0 && data[0] == '[' {
			var batch []Config
			if err := json.Unmarshal(data, &batch); err != nil {
				return fmt.Errorf("parse adapter config array %q: %w", path, err)
			}
			configs = append(configs, batch...)
		} else {
			// 先尝试 ConfigFile 格式
			var file ConfigFile
			if err := json.Unmarshal(data, &file); err == nil && len(file.Adapters) > 0 {
				configs = append(configs, file.Adapters...)
			} else {
				var cfg Config
				if err := json.Unmarshal(data, &cfg); err != nil {
					return fmt.Errorf("parse adapter config %q: %w", path, err)
				}
				configs = append(configs, cfg)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return configs, nil
}

// DBLoader loads adapter configs from the platform_settings table.
type DBLoader struct {
	Store config.Store
	Key   string
}

// LoadAll reads adapter configs from the database as a JSON array.
func (dl *DBLoader) LoadAll(ctx context.Context) ([]Config, error) {
	if dl.Store == nil {
		return nil, nil
	}
	key := dl.Key
	if key == "" {
		key = "adapter_configs"
	}

	value, ok, err := dl.Store.GetPlatformSetting(ctx, key)
	if err != nil {
		return nil, fmt.Errorf("get adapter configs from db: %w", err)
	}
	if !ok || strings.TrimSpace(value) == "" {
		return nil, nil
	}

	var configs []Config
	if err := json.Unmarshal([]byte(value), &configs); err != nil {
		return nil, fmt.Errorf("parse adapter configs from db: %w", err)
	}
	return configs, nil
}

// MultiLoader combines multiple loaders.
type MultiLoader struct {
	loaders []Loader
}

// NewMultiLoader creates a multi-loader.
func NewMultiLoader(loaders ...Loader) *MultiLoader {
	return &MultiLoader{loaders: loaders}
}

// LoadAll loads from all sources and merges results.
func (ml *MultiLoader) LoadAll(ctx context.Context) ([]Config, error) {
	var allConfigs []Config
	seen := map[string]struct{}{}

	for _, loader := range ml.loaders {
		configs, err := loader.LoadAll(ctx)
		if err != nil {
			return nil, err
		}
		for _, cfg := range configs {
			if cfg.ID == "" {
				continue
			}
			if _, ok := seen[cfg.ID]; ok {
				continue // skip duplicate
			}
			seen[cfg.ID] = struct{}{}
			if cfg.Enabled == false {
				// Skip explicitly disabled configs
				continue
			}
			allConfigs = append(allConfigs, cfg)
		}
	}
	return allConfigs, nil
}
