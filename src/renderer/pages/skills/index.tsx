/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import AionScrollArea from '@/renderer/components/base/AionScrollArea';
import { Avatar, Button, Drawer, Empty, Input, Message, Modal, Spin, Tag, Tooltip, Typography } from '@arco-design/web-react';
import { FolderOpen, Plus, Refresh, Search, Right } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface SkillInfo {
  name: string;
  description: string;
  location: string;
  isCustom: boolean;
}

interface PendingSkill {
  name: string;
  description: string;
  path: string;
}

type SourceFilter = 'all' | 'builtin' | 'custom';

type AgentItem = {
  key: string;
  name: string;
  emoji: string;
};

const COMPATIBLE_AGENTS: AgentItem[] = [
  { key: 'gemini', name: 'Gemini', emoji: '♊' },
  { key: 'claude', name: 'Claude', emoji: '✳' },
  { key: 'codex', name: 'Codex', emoji: '⚡' },
  { key: 'opencode', name: 'OpenCode', emoji: '⌘' },
];

const SkillsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [messageApi, messageContextHolder] = Message.useMessage();

  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(460);

  const [skillsModalVisible, setSkillsModalVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [skillPath, setSkillPath] = useState('');
  const [commonPaths, setCommonPaths] = useState<Array<{ name: string; path: string }>>([]);

  useEffect(() => {
    const updateDrawerWidth = () => {
      if (typeof window === 'undefined') return;
      const nextWidth = Math.min(520, Math.max(320, Math.floor(window.innerWidth - 24)));
      setDrawerWidth(nextWidth);
    };

    updateDrawerWidth();
    window.addEventListener('resize', updateDrawerWidth);
    return () => window.removeEventListener('resize', updateDrawerWidth);
  }, []);

  const loadSkills = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const list = await ipcBridge.fs.listAvailableSkills.invoke();
      setSkills(list || []);
    } catch (error) {
      console.error('Failed to load skills:', error);
      messageApi.error('Refresh failed');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSkills();
  }, []);

  useEffect(() => {
    if (!skillsModalVisible) return;

    void (async () => {
      try {
        const response = await ipcBridge.fs.detectCommonSkillPaths.invoke();
        if (response.success && response.data) {
          setCommonPaths(response.data);
        }
      } catch (error) {
        console.error('Failed to detect common skill paths:', error);
      }
    })();
  }, [skillsModalVisible]);

  const filteredSkills = useMemo(() => {
    const q = search.trim().toLowerCase();

    return skills
      .filter((skill) => {
        if (sourceFilter === 'builtin' && skill.isCustom) return false;
        if (sourceFilter === 'custom' && !skill.isCustom) return false;
        if (!q) return true;
        return skill.name.toLowerCase().includes(q) || skill.description.toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [skills, search, sourceFilter]);

  const importSkillsFromPaths = useCallback(async () => {
    const currentPath = skillPath.trim();
    if (!currentPath) {
      messageApi.warning(t('settings.pleaseSelectSkillPath', { defaultValue: 'Please select a skill folder path' }));
      return;
    }

    setImporting(true);
    try {
      const paths = currentPath
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      const foundSkills: PendingSkill[] = [];
      for (const path of paths) {
        const response = await ipcBridge.fs.scanForSkills.invoke({ folderPath: path });
        if (response.success && response.data) {
          foundSkills.push(...response.data);
        }
      }

      if (foundSkills.length === 0) {
        messageApi.warning(t('settings.noSkillsFound', { defaultValue: 'No valid skills found in the selected path(s)' }));
        return;
      }

      const uniqueByName = new Map<string, PendingSkill>();
      for (const skill of foundSkills) {
        if (!uniqueByName.has(skill.name)) {
          uniqueByName.set(skill.name, skill);
        }
      }

      const existingNames = new Set(skills.map((skill) => skill.name));
      let imported = 0;
      let skipped = 0;
      let failed = 0;

      for (const skill of uniqueByName.values()) {
        if (existingNames.has(skill.name)) {
          skipped += 1;
          continue;
        }

        const result = await ipcBridge.fs.importSkill.invoke({ skillPath: skill.path });
        if (result.success) {
          imported += 1;
          existingNames.add(skill.name);
        } else {
          failed += 1;
        }
      }

      await loadSkills();

      if (imported > 0) {
        messageApi.success(`已导入到全局技能库 ${imported} 个（跳过 ${skipped}，失败 ${failed}）`);
      } else {
        messageApi.warning(`没有新增技能（跳过 ${skipped}，失败 ${failed}）`);
      }

      setSkillsModalVisible(false);
      setSkillPath('');
    } catch (error) {
      console.error('Failed to import skills:', error);
      messageApi.error(t('settings.skillScanFailed', { defaultValue: 'Failed to scan skills' }));
    } finally {
      setImporting(false);
    }
  }, [skillPath, messageApi, t, skills, loadSkills]);

  const sourceLabel = (isCustom: boolean): string => (isCustom ? '我的技能' : '内置技能');

  return (
    <div className='h-full w-full overflow-hidden'>
      {messageContextHolder}

      <div className='mx-auto h-full w-full max-w-1320px px-12px md:px-20px py-14px flex flex-col gap-12px'>
        <div className='rounded-12px border border-border-2 bg-2 p-12px md:p-14px'>
          <div className='flex items-start justify-between gap-10px flex-wrap'>
            <div className='min-w-0'>
              <Typography.Title heading={5} style={{ marginBottom: 2 }}>
                Skills
              </Typography.Title>
              <Typography.Text type='secondary'>全局技能库：导入后，支持 Skills 的 Agent 在启用后都可读取。</Typography.Text>
            </div>
            <div className='flex items-center gap-8px'>
              <Button icon={<Refresh size={14} />} onClick={() => void loadSkills()} loading={loading} type='secondary'>
                {t('common.refresh', { defaultValue: 'Refresh' })}
              </Button>
              <Button type='primary' icon={<Plus size={14} />} onClick={() => setSkillsModalVisible(true)}>
                {t('settings.addSkills', { defaultValue: 'Add Skills' })}
              </Button>
            </div>
          </div>

          <div className='mt-10px flex items-center gap-6px flex-wrap'>
            <span className='text-12px text-t-secondary'>支持 Agent</span>
            {COMPATIBLE_AGENTS.map((agent) => (
              <Tag key={agent.key} size='small' color='blue'>
                {agent.name}
              </Tag>
            ))}
          </div>
        </div>

        <div className='flex items-center gap-8px flex-wrap'>
          <Input value={search} onChange={setSearch} prefix={<Search size={14} />} placeholder='搜索技能' className='w-full md:w-320px' />
          <div className='flex items-center gap-6px'>
            <Button size='small' type={sourceFilter === 'all' ? 'primary' : 'secondary'} onClick={() => setSourceFilter('all')}>
              全部
            </Button>
            <Button size='small' type={sourceFilter === 'builtin' ? 'primary' : 'secondary'} onClick={() => setSourceFilter('builtin')}>
              内置
            </Button>
            <Button size='small' type={sourceFilter === 'custom' ? 'primary' : 'secondary'} onClick={() => setSourceFilter('custom')}>
              我的
            </Button>
          </div>
          <span className='text-12px text-t-secondary'>共 {filteredSkills.length} 个</span>
        </div>

        <AionScrollArea className='flex-1 min-h-0'>
          <Spin loading={loading} className='w-full'>
            {filteredSkills.length > 0 ? (
              <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-10px pb-12px'>
                {filteredSkills.map((skill) => (
                  <button
                    key={`${skill.name}-${skill.location}`}
                    type='button'
                    onClick={() => {
                      setSelectedSkill(skill);
                      setDetailVisible(true);
                    }}
                    className='group text-left p-12px rounded-10px border border-border-2 bg-2 hover:bg-fill-1 hover:border-primary/40 transition-colors'
                  >
                    <div className='flex items-center justify-between gap-8px'>
                      <div className='text-14px font-medium text-t-primary truncate'>{skill.name}</div>
                      <Right size={14} className='text-t-secondary group-hover:text-t-primary' />
                    </div>
                    <div className='mt-8px flex items-center gap-6px flex-wrap'>
                      <Tag size='small' color={skill.isCustom ? 'arcoblue' : 'green'}>
                        {sourceLabel(skill.isCustom)}
                      </Tag>
                      <Tag size='small' color='gray'>
                        全局可用
                      </Tag>
                    </div>
                    <div className='text-12px text-t-secondary mt-8px line-clamp-2'>{skill.description || '暂无描述'}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className='py-48px'>
                <Empty description='未找到匹配技能' />
              </div>
            )}
          </Spin>
        </AionScrollArea>
      </div>

      <Drawer
        title={selectedSkill?.name || 'Skill'}
        visible={detailVisible}
        placement='right'
        width={drawerWidth}
        onCancel={() => setDetailVisible(false)}
        footer={
          <div className='flex items-center justify-between gap-8px'>
            <div className='text-12px text-t-secondary'>绑定入口保持在原有设置流程</div>
            <Button type='primary' onClick={() => navigate('/settings/agent')}>
              去 Assistants
            </Button>
          </div>
        }
      >
        {selectedSkill && (
          <div className='space-y-12px'>
            <div className='flex items-center gap-8px flex-wrap'>
              <Tag color={selectedSkill.isCustom ? 'arcoblue' : 'green'}>{sourceLabel(selectedSkill.isCustom)}</Tag>
              <Tag color='green'>全局可用</Tag>
            </div>

            <div className='p-12px rounded-8px bg-fill-1 border border-border-2'>
              <div className='text-12px text-t-secondary mb-6px'>技能说明</div>
              <div className='text-13px text-t-primary'>{selectedSkill.description || '暂无描述'}</div>
            </div>

            <div className='p-12px rounded-8px bg-fill-1 border border-border-2'>
              <div className='text-12px text-t-secondary mb-6px'>兼容 Agent</div>
              <div className='flex items-center gap-8px flex-wrap'>
                {COMPATIBLE_AGENTS.map((agent) => (
                  <Tooltip key={agent.key} content={agent.name}>
                    <Avatar size={28} shape='square' className='bg-bg-1 border border-border-2'>
                      <span className='text-12px'>{agent.emoji}</span>
                    </Avatar>
                  </Tooltip>
                ))}
              </div>
            </div>

            <div className='p-12px rounded-8px bg-fill-1 border border-border-2'>
              <div className='text-12px text-t-secondary mb-6px'>位置</div>
              <div className='text-12px text-t-primary break-all'>{selectedSkill.location}</div>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        visible={skillsModalVisible}
        title={t('settings.addSkillsTitle', { defaultValue: 'Add Skills' })}
        okText={t('common.confirm', { defaultValue: 'Confirm' })}
        cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
        confirmLoading={importing}
        onOk={() => void importSkillsFromPaths()}
        onCancel={() => {
          setSkillsModalVisible(false);
          setSkillPath('');
        }}
        className='w-[90vw] md:w-[560px]'
      >
        <div className='space-y-16px'>
          {commonPaths.length > 0 && (
            <div>
              <div className='text-12px text-t-secondary mb-8px'>{t('settings.quickScan', { defaultValue: 'Quick Scan Common Paths' })}</div>
              <div className='flex flex-wrap gap-8px'>
                {commonPaths.map((cp) => (
                  <Button
                    key={cp.path}
                    size='small'
                    type='secondary'
                    onClick={() => {
                      if (skillPath.includes(cp.path)) return;
                      setSkillPath(skillPath ? `${skillPath}, ${cp.path}` : cp.path);
                    }}
                  >
                    {cp.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className='space-y-12px'>
            <Typography.Text>{t('settings.skillFolderPath', { defaultValue: 'Skill Folder Path' })}</Typography.Text>
            <Input.Group className='flex items-center gap-8px'>
              <Input
                value={skillPath}
                onChange={(value) => setSkillPath(value)}
                placeholder={t('settings.skillPathPlaceholder', {
                  defaultValue: 'Enter or browse skill folder path',
                })}
                className='flex-1'
              />
              <Button
                type='outline'
                icon={<FolderOpen size={16} />}
                onClick={async () => {
                  try {
                    const result = await ipcBridge.dialog.showOpen.invoke({
                      properties: ['openDirectory', 'multiSelections'],
                    });
                    if (result && result.length > 0) {
                      setSkillPath(result.join(', '));
                    }
                  } catch (error) {
                    console.error('Failed to open directory dialog:', error);
                  }
                }}
              >
                {t('common.browse', { defaultValue: 'Browse' })}
              </Button>
            </Input.Group>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SkillsPage;
